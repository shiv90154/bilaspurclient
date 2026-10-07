import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
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
  ListStudentsQueryDto,
  UpdateStudentDto,
  UploadDocumentDto,
} from './dto/student.dto.js';
import {
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  StudentFilesService,
  type UploadedFile as Upload,
} from './student-files.service.js';
import { StudentsService } from './students.service.js';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly files: StudentFilesService,
  ) {}

  // Fixed paths first: "me" and "export" must not be read as an :id.

  /** The signed-in student's own profile (app + student web). */
  @Roles(Role.STUDENT)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.students.me(user);
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
  @Delete(':id/documents/:docId')
  removeDocument(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.files.removeDocument(admin, id, docId);
  }
}
