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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  AssignBatchDto,
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from './dto/student.dto.js';
import { StudentsService } from './students.service.js';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

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
}
