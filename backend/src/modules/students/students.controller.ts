import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  ApproveStudentDto,
  AssignBatchDto,
  ListRegistrationsQueryDto,
  RejectStudentDto,
  CreateStudentDto,
  ExportStudentsQueryDto,
  ImportStudentsDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
  UploadDocumentDto,
} from './dto/student.dto.js';
import {
  ChangeEmailStartDto,
  ChangeEmailVerifyDto,
  NotificationPrefsDto,
  ReviewDocumentDto,
  UpdateMyProfileDto,
  UploadMyDocumentDto,
} from './dto/self.dto.js';
import {
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  StudentFilesService,
  type UploadedFile as Upload,
} from './student-files.service.js';
import { StudentSelfService } from './student-self.service.js';
import { StudentsService } from './students.service.js';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly files: StudentFilesService,
    private readonly self: StudentSelfService,
  ) {}

  // Fixed paths first: "me" and "export" must not be read as an :id.

  /** The signed-in student's own profile (app + student web). */
  @Roles(Role.STUDENT)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.students.me(user);
  }

  // ── the student's own account (app + student web) ──

  @Roles(Role.STUDENT)
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMyProfileDto) {
    return this.self.updateProfile(user, dto);
  }

  @Roles(Role.STUDENT)
  @Post('me/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  async setMyPhoto(@CurrentUser() user: AuthUser, @UploadedFile() file: Upload | undefined) {
    return this.files.setPhoto(user, await this.self.studentId(user), file);
  }

  @Roles(Role.STUDENT)
  @Delete('me/photo')
  async removeMyPhoto(@CurrentUser() user: AuthUser) {
    return this.files.removePhoto(user, await this.self.studentId(user));
  }

  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('me/email/start')
  emailStart(@CurrentUser() user: AuthUser, @Body() dto: ChangeEmailStartDto) {
    return this.self.emailStart(user, dto.email);
  }

  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('me/email/verify')
  emailVerify(@CurrentUser() user: AuthUser, @Body() dto: ChangeEmailVerifyDto) {
    return this.self.emailVerify(user, dto.email, dto.code);
  }

  @Roles(Role.STUDENT)
  @Get('me/documents')
  async myDocuments(@CurrentUser() user: AuthUser) {
    return this.files.listDocuments(await this.self.studentId(user));
  }

  @Roles(Role.STUDENT)
  @Post('me/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  async addMyDocument(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Upload | undefined,
    @Body() dto: UploadMyDocumentDto,
  ) {
    return this.files.addDocument(user, await this.self.studentId(user), file, dto, true);
  }

  @Roles(Role.STUDENT)
  @Get('me/documents/:docId/url')
  async myDocumentUrl(
    @CurrentUser() user: AuthUser,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Query('download') download?: string,
  ) {
    return this.files.documentUrl(user, await this.self.studentId(user), docId, download === '1' || download === 'true');
  }

  @Roles(Role.STUDENT)
  @Delete('me/documents/:docId')
  async removeMyDocument(@CurrentUser() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.files.removeDocument(user, await this.self.studentId(user), docId, true);
  }

  @Roles(Role.STUDENT)
  @Get('me/devices')
  myDevices(@CurrentUser() user: AuthUser) {
    return this.self.devices(user);
  }

  @Roles(Role.STUDENT)
  @Get('me/notification-settings')
  notificationPrefs(@CurrentUser() user: AuthUser) {
    return this.self.notificationPrefs(user);
  }

  @Roles(Role.STUDENT)
  @Put('me/notification-settings')
  setNotificationPrefs(@CurrentUser() user: AuthUser, @Body() dto: NotificationPrefsDto) {
    return this.self.setNotificationPrefs(user, dto);
  }

  @Roles(Role.STUDENT)
  @Get('me/id-card')
  idCard(@CurrentUser() user: AuthUser) {
    return this.self.idCard(user);
  }

  /** The QR on a student's ID card opens the website, which asks here whether the card is valid. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('id-card/:code')
  verifyCard(@Param('code') code: string) {
    return this.self.verifyCard(code);
  }

  /** Documents students uploaded that wait for a review. */
  @Roles(Role.ADMIN)
  @Get('documents/pending')
  pendingDocuments() {
    return this.files.pendingDocuments();
  }

  /** Self-registrations waiting for approval (or already handled, with ?status=). */
  @Roles(Role.ADMIN)
  @Get('registrations')
  registrations(@Query() q: ListRegistrationsQueryDto) {
    return this.students.registrations(q);
  }

  /** CSV of every student matching the list filters. */
  @Roles(Role.ADMIN, Role.FACULTY)
  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() q: ExportStudentsQueryDto,
    @Res() res: Response,
  ) {
    const { header, rows } = await this.students.exportRows(user, q);
    sendCsv(res, 'students', header, rows);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListStudentsQueryDto) {
    return this.students.list(user, q);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.get(user, id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.create(admin, dto);
  }

  /** Bulk add from Excel/CSV. Per-row results; one bad row never blocks the others. */
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post('import')
  importMany(@CurrentUser() admin: AuthUser, @Body() dto: ImportStudentsDto) {
    return this.students.importMany(admin, dto.rows);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(admin, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.remove(admin, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/batches')
  assignBatch(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBatchDto,
  ) {
    return this.students.assignBatch(admin, id, dto.batchId);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/batches/:batchId')
  removeBatch(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.students.removeBatch(admin, id, batchId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveStudentDto,
  ) {
    return this.students.approve(admin, id, dto.batchIds);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectStudentDto,
  ) {
    return this.students.reject(admin, id, dto.note);
  }

  /** Tests, attendance, doubts and material use of one student. */
  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id/records')
  records(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.recordsFor(user, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  setPhoto(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
  ) {
    return this.files.setPhoto(admin, id, file);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/photo')
  removePhoto(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.removePhoto(admin, id);
  }

  @Roles(Role.ADMIN)
  @Get(':id/documents')
  documents(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.listDocuments(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  addDocument(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.files.addDocument(admin, id, file, dto);
  }

  @Roles(Role.ADMIN)
  @Get(':id/documents/:docId/url')
  documentUrl(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Query('download') download?: string,
  ) {
    return this.files.documentUrl(admin, id, docId, download === '1' || download === 'true');
  }

  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post(':id/documents/:docId/approve')
  approveDocument(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.files.reviewDocument(admin, id, docId, true);
  }

  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post(':id/documents/:docId/reject')
  rejectDocument(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.files.reviewDocument(admin, id, docId, false, dto.note);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/documents/:docId')
  removeDocument(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.files.removeDocument(admin, id, docId);
  }
}
