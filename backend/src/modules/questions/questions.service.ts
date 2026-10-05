import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { QuestionType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
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
  ) {}

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
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id }, include: INCLUDE });
    if (!question) throw new NotFoundException('Question not found');
    return question;
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
    return question;
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
    const existing = await this.get(id);
    const type = dto.type ?? existing.type;
    const options = dto.options ?? existing.options;
    if (dto.options || dto.type) validateOptions(type, options);
    if (dto.topicId) await this.assertTopic(dto.topicId);

    if (dto.options) {
      // Changing options after students answered would silently rewrite their scores.
      const answered = await this.prisma.attemptAnswer.count({ where: { questionId: id } });
      if (answered > 0) {
        throw new ConflictException(
          'This question has student answers. Archive it and create a corrected copy instead.',
        );
      }
    }

    const { options: newOptions, ...fields } = dto;
    const question = await this.prisma.$transaction(async (tx) => {
      if (newOptions) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: this.optionRows(newOptions).map((o) => ({ ...o, questionId: id })),
        });
      }
      return tx.question.update({ where: { id }, data: fields, include: INCLUDE });
    });
    await this.activity.log({
      actorId: user.id,
      action: 'question.update',
      entity: 'question',
      entityId: id,
    });
    return question;
  }

  /** Questions in tests are never deleted: archive hides them from the bank only. */
  archive(user: AuthUser, id: string) {
    return this.update(user, id, { active: false });
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
