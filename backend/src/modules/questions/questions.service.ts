import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { QuestionType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { StorageService, type StoredExt } from '../storage/storage.service.js';
import type {
  CreateQuestionDto,
  ListQuestionsQueryDto,
  OptionDto,
  UpdateQuestionDto,
} from './dto/question.dto.js';

const INCLUDE = {
  options: { orderBy: { position: 'asc' } },
  topic: { select: { id: true, name: true, subject: { select: { id: true, name: true } } } },
} satisfies Prisma.QuestionInclude;

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export interface UploadedImage {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** The file's own bytes decide what it is. The name and Content-Type come from the client. */
export function imageExt(buf: Buffer): StoredExt | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** Rules every question must satisfy, whatever route it came in through. */
export function validateOptions(type: QuestionType, options: OptionDto[]): void {
  const correct = options.filter((o) => o.isCorrect).length;
  if (correct === 0) throw new BadRequestException('Mark at least one option as correct');
  if (type === QuestionType.SINGLE && correct !== 1) {
    throw new BadRequestException('A single-answer question needs exactly one correct option');
  }
}

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  /** Staff never see storage keys: the image comes as a signed link valid for an hour. */
  private present<T extends { imageKey: string | null }>(q: T) {
    const { imageKey, ...rest } = q;
    return {
      ...rest,
      imageUrl: imageKey ? this.storage.signedUrl(imageKey, 'question-image', 'inline', 3600) : null,
    };
  }

  async list(q: ListQuestionsQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.QuestionWhereInput = {
      ...(q.topicId && { topicId: q.topicId }),
      ...(q.subjectId && { topic: { subjectId: q.subjectId } }),
      ...(q.difficulty && { difficulty: q.difficulty }),
      ...(q.active !== undefined && { active: q.active }),
      ...(q.search && { text: { contains: q.search, mode: 'insensitive' } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
        include: INCLUDE,
      }),
      this.prisma.question.count({ where }),
    ]);
    return { items: items.map((i) => this.present(i)), page: q.page, limit: q.limit, total };
  }

  private async load(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id }, include: INCLUDE });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async get(id: string) {
    return this.present(await this.load(id));
  }

  async create(user: AuthUser, dto: CreateQuestionDto) {
    const type = dto.type ?? QuestionType.SINGLE;
    validateOptions(type, dto.options);
    await this.assertTopic(dto.topicId);
    const question = await this.prisma.question.create({
      data: {
        topicId: dto.topicId,
        text: dto.text,
        type,
        difficulty: dto.difficulty,
        explanation: dto.explanation,
        createdById: user.id,
        options: { create: this.optionRows(dto.options) },
      },
      include: INCLUDE,
    });
    await this.activity.log({
      actorId: user.id,
      action: 'question.create',
      entity: 'question',
      entityId: question.id,
    });
    return this.present(question);
  }

  async createMany(user: AuthUser, items: CreateQuestionDto[]) {
    // Validate everything first so a bad row in the middle does not leave a half import.
    for (const [i, dto] of items.entries()) {
      try {
        validateOptions(dto.type ?? QuestionType.SINGLE, dto.options);
      } catch (err) {
        const msg = err instanceof BadRequestException ? err.message : 'invalid';
        throw new BadRequestException(`Question #${i + 1}: ${msg}`);
      }
    }
    const topicIds = [...new Set(items.map((d) => d.topicId))];
    const found = await this.prisma.topic.count({ where: { id: { in: topicIds } } });
    if (found !== topicIds.length) throw new BadRequestException('Unknown topicId in import');

    const created = await this.prisma.$transaction(
      items.map((dto) =>
        this.prisma.question.create({
          data: {
            topicId: dto.topicId,
            text: dto.text,
            type: dto.type ?? QuestionType.SINGLE,
            difficulty: dto.difficulty,
            explanation: dto.explanation,
            createdById: user.id,
            options: { create: this.optionRows(dto.options) },
          },
          select: { id: true },
        }),
      ),
    );
    await this.activity.log({
      actorId: user.id,
      action: 'question.bulk_create',
      entity: 'question',
      meta: { count: created.length },
    });
    return { created: created.length };
  }

  async update(user: AuthUser, id: string, dto: UpdateQuestionDto) {
    const existing = await this.load(id);
    const type = dto.type ?? existing.type;
    const options = dto.options ?? existing.options;
    if (dto.options || dto.type) validateOptions(type, options);
    if (dto.topicId) await this.assertTopic(dto.topicId);

    const { options: newOptions, ...fields } = dto;
    const answered = newOptions || dto.type ? await this.prisma.attemptAnswer.count({ where: { questionId: id } }) : 0;
    if (answered > 0) {
      // Students have already answered. Fixing wording is safe; changing what is right or wrong
      // (or the number of options, or the type) would silently rewrite their scores.
      const same =
        (dto.type === undefined || dto.type === existing.type) &&
        (!newOptions ||
          (newOptions.length === existing.options.length &&
            newOptions.every((o, i) => o.isCorrect === existing.options[i]!.isCorrect)));
      if (!same) {
        throw new ConflictException(
          'Students have already answered this question. You can fix the wording, but not which option is correct. Archive it and create a corrected copy instead.',
        );
      }
    }

    const question = await this.prisma.$transaction(async (tx) => {
      if (newOptions) {
        if (answered > 0) {
          // Keep the option ids (answers point at them): update the text in place.
          for (const [i, o] of newOptions.entries()) {
            await tx.questionOption.update({ where: { id: existing.options[i]!.id }, data: { text: o.text } });
          }
        } else {
          await tx.questionOption.deleteMany({ where: { questionId: id } });
          await tx.questionOption.createMany({
            data: this.optionRows(newOptions).map((o) => ({ ...o, questionId: id })),
          });
        }
      }
      return tx.question.update({ where: { id }, data: fields, include: INCLUDE });
    });
    await this.activity.log({
      actorId: user.id,
      action: 'question.update',
      entity: 'question',
      entityId: id,
    });
    return this.present(question);
  }

  /** Questions in tests are never deleted: archive hides them from the bank only. */
  archive(user: AuthUser, id: string) {
    return this.update(user, id, { active: false });
  }

  /** Attach (or replace) the question's picture: a diagram, graph or figure. */
  async setImage(user: AuthUser, id: string, file: UploadedImage | undefined) {
    const existing = await this.load(id);
    if (!file?.buffer?.length) throw new BadRequestException('Attach an image in the "file" field');
    if (file.size > MAX_IMAGE_BYTES) throw new PayloadTooLargeException('Image is larger than 3 MB');
    const ext = imageExt(file.buffer);
    if (!ext) throw new UnsupportedMediaTypeException('Only PNG, JPG or WebP images are supported');

    const key = await this.storage.put(file.buffer, ext);
    try {
      const updated = await this.prisma.question.update({ where: { id }, data: { imageKey: key }, include: INCLUDE });
      if (existing.imageKey) await this.storage.remove(existing.imageKey);
      await this.activity.log({ actorId: user.id, action: 'question.image_set', entity: 'question', entityId: id });
      return this.present(updated);
    } catch (err) {
      await this.storage.remove(key);
      throw err;
    }
  }

  async removeImage(user: AuthUser, id: string) {
    const existing = await this.load(id);
    if (!existing.imageKey) return this.present(existing);
    const updated = await this.prisma.question.update({ where: { id }, data: { imageKey: null }, include: INCLUDE });
    await this.storage.remove(existing.imageKey);
    await this.activity.log({ actorId: user.id, action: 'question.image_remove', entity: 'question', entityId: id });
    return this.present(updated);
  }

  private optionRows(options: OptionDto[]) {
    return options.map((o, i) => ({
      text: o.text,
      isCorrect: o.isCorrect,
      position: o.position ?? i,
    }));
  }

  private async assertTopic(topicId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new BadRequestException('Unknown topicId');
  }
}
