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
import { CoursesService } from './courses.service.js';
import {
  CreateCourseDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
} from './dto/course.dto.js';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get()
  list(@Query() q: ListCoursesQueryDto) {
    return this.courses.list(q);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.courses.get(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(admin, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(admin, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  archive(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.courses.archive(admin, id);
  }
}
