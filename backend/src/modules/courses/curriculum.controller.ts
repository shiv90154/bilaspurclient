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
import { CurriculumService } from './curriculum.service.js';
import {
  CreateSubjectDto,
  CreateTopicDto,
  ListSubjectsQueryDto,
  RenameDto,
} from './dto/curriculum.dto.js';

@ApiTags('curriculum')
@ApiBearerAuth()
@Controller()
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get('subjects')
  list(@Query() q: ListSubjectsQueryDto) {
    return this.curriculum.listSubjects(q.courseId);
  }

  @Roles(Role.ADMIN)
  @Post('subjects')
  createSubject(@CurrentUser() u: AuthUser, @Body() dto: CreateSubjectDto) {
    return this.curriculum.createSubject(u, dto.courseId, dto.name);
  }

  @Roles(Role.ADMIN)
  @Patch('subjects/:id')
  renameSubject(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameDto,
  ) {
    return this.curriculum.renameSubject(u, id, dto.name);
  }

  @Roles(Role.ADMIN)
  @Delete('subjects/:id')
  deleteSubject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.curriculum.deleteSubject(u, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post('topics')
  createTopic(@CurrentUser() u: AuthUser, @Body() dto: CreateTopicDto) {
    return this.curriculum.createTopic(u, dto.subjectId, dto.name);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Patch('topics/:id')
  renameTopic(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameDto,
  ) {
    return this.curriculum.renameTopic(u, id, dto.name);
  }

  @Roles(Role.ADMIN)
  @Delete('topics/:id')
  deleteTopic(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.curriculum.deleteTopic(u, id);
  }
}
