import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { DocumentStatus } from '../../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { imageExt } from '../questions/questions.service.js';
import { CONTENT_TYPES, StorageService, type StoredExt } from '../storage/storage.service.js';
import type { UploadDocumentDto } from './dto/student.dto.js';

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const PDF_MAGIC = Buffer.from('%PDF-');

const DOC_SELECT = {
  id: true,
  type: true,
  fileName: true,
  mimeType: true,
  size: true,
  status: true,
  byStudent: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
} as const;

/** The bits of a multer file we use (no @types/multer in this project). */
export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/**
 * Student photo and documents (ID proof, marksheet, ...). Personal data: files live in private
 * storage, only admins and the student themself reach the documents, and each one is opened
 * through a short-lived link whose issue is written to the activity log. A document the student
 * uploads waits (PENDING) until an admin approves or rejects it.
 */
@Injectable()
export class StudentFilesService {
  private readonly logger = new Logger(StudentFilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  /** By an admin or by the student themself (`actor`). */
  async setPhoto(actor: AuthUser, studentId: string, file: UploadedFile | undefined) {
    const student = await this.student(studentId);
    if (!file?.buffer?.length) throw new BadRequestException('Attach a picture in the "file" field');
    if (file.size > MAX_PHOTO_BYTES) throw new PayloadTooLargeException('Photo is larger than 3 MB');
    const ext = imageExt(file.buffer);
    if (!ext) throw new UnsupportedMediaTypeException('Photo must be a PNG, JPG or WebP picture');

    const key = await this.storage.put(file.buffer, ext);
    await this.prisma.student.update({ where: { id: studentId }, data: { photoKey: key } });
    if (student.photoKey) await this.removeQuietly(student.photoKey);
    await this.log(actor, 'student.photo-set', studentId);
    return { photoUrl: this.storage.signedUrl(key, 'photo', 'inline', 3600) };
  }

  async removePhoto(actor: AuthUser, studentId: string) {
    const student = await this.student(studentId);
    if (!student.photoKey) return { photoUrl: null };
    await this.prisma.student.update({ where: { id: studentId }, data: { photoKey: null } });
    await this.removeQuietly(student.photoKey);
    await this.log(actor, 'student.photo-remove', studentId);
    return { photoUrl: null };
  }

  async listDocuments(studentId: string) {
    await this.student(studentId);
    return this.prisma.studentDocument.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: DOC_SELECT,
    });
  }

  /** Admin: documents students uploaded that nobody has looked at yet, oldest first. */
  pendingDocuments() {
    return this.prisma.studentDocument.findMany({
      where: { status: DocumentStatus.PENDING, student: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        ...DOC_SELECT,
        student: { select: { id: true, admissionNo: true, user: { select: { name: true, phone: true } } } },
      },
    });
  }

  async addDocument(
    actor: AuthUser,
    studentId: string,
    file: UploadedFile | undefined,
    dto: Pick<UploadDocumentDto, 'type' | 'label'>,
    byStudent = false,
  ) {
    await this.student(studentId);
    if (!file?.buffer?.length) throw new BadRequestException('Attach the document in the "file" field');
    if (file.size > MAX_DOCUMENT_BYTES) throw new PayloadTooLargeException('File is larger than 10 MB');
    // The file's own bytes decide what it is; its name and Content-Type come from the browser.
    const ext: StoredExt | null = file.buffer.subarray(0, 5).equals(PDF_MAGIC) ? 'pdf' : imageExt(file.buffer);
    if (!ext) throw new UnsupportedMediaTypeException('Upload a PDF, PNG, JPG or WebP file');

    const base = (dto.label?.trim() || file.originalname.replace(/\.[^.]*$/, '') || dto.type.toLowerCase())
      .replace(/[\\/:*?"<>|]+/g, '_')
      .slice(0, 100);
    const key = await this.storage.put(file.buffer, ext);
    const doc = await this.prisma.studentDocument.create({
      data: {
        studentId,
        type: dto.type,
        fileKey: key,
        fileName: `${base}.${ext}`,
        mimeType: CONTENT_TYPES[ext],
        size: file.size,
        byStudent,
        status: byStudent ? DocumentStatus.PENDING : DocumentStatus.APPROVED,
      },
      select: DOC_SELECT,
    });
    await this.log(actor, 'student.document-add', studentId, { documentId: doc.id, type: dto.type });
    return doc;
  }

  /** Admin approves or rejects a document the student uploaded; the student gets a push. */
  async reviewDocument(admin: AuthUser, studentId: string, docId: string, approve: boolean, note?: string) {
    const doc = await this.document(studentId, docId);
    const updated = await this.prisma.studentDocument.update({
      where: { id: doc.id },
      data: {
        status: approve ? DocumentStatus.APPROVED : DocumentStatus.REJECTED,
        reviewNote: approve ? null : note || null,
        reviewedAt: new Date(),
      },
      select: DOC_SELECT,
    });
    await this.log(admin, approve ? 'student.document-approve' : 'student.document-reject', studentId, {
      documentId: doc.id,
      type: doc.type,
    });
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } });
    if (student && doc.byStudent) {
      void this.notifications.sendToUsers([student.userId], {
        title: approve ? 'Document approved' : 'Document not accepted',
        body: approve ? doc.fileName : `${doc.fileName}${note ? `: ${note}` : '. Please upload it again.'}`,
        data: { type: 'document_review', documentId: doc.id },
      });
    }
    return updated;
  }

  /** A 5-minute link to open the document. Opening personal documents is logged. */
  async documentUrl(actor: AuthUser, studentId: string, docId: string, download: boolean) {
    const doc = await this.document(studentId, docId);
    await this.log(actor, 'student.document-view', studentId, { documentId: doc.id, type: doc.type });
    return {
      url: this.storage.signedUrl(doc.fileKey, doc.fileName, download ? 'attachment' : 'inline', 300),
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    };
  }

  /** `ownOnly`: the student may delete only their own uploads that were not approved yet. */
  async removeDocument(actor: AuthUser, studentId: string, docId: string, ownOnly = false) {
    const doc = await this.document(studentId, docId);
    if (ownOnly && (!doc.byStudent || doc.status === DocumentStatus.APPROVED)) {
      throw new BadRequestException('An approved document can only be removed by the institute');
    }
    await this.prisma.studentDocument.delete({ where: { id: doc.id } });
    await this.removeQuietly(doc.fileKey);
    await this.log(actor, 'student.document-remove', studentId, { documentId: doc.id, type: doc.type });
    return { id: doc.id, deleted: true };
  }

  private async student(id: string) {
    const s = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, photoKey: true },
    });
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }

  private async document(studentId: string, docId: string) {
    const doc = await this.prisma.studentDocument.findFirst({ where: { id: docId, studentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /** The row is already gone; a leftover file is only wasted disk, never a failed request. */
  private async removeQuietly(key: string) {
    try {
      await this.storage.remove(key);
    } catch (err) {
      this.logger.warn(`Could not delete file ${key}: ${String(err)}`);
    }
  }

  private log(actor: AuthUser, action: string, studentId: string, meta?: Record<string, string>) {
    return this.activity.log({ actorId: actor.id, action, entity: 'student', entityId: studentId, meta });
  }
}
