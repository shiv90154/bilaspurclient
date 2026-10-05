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
import { ClassesService } from './classes.service.js';
import { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from './dto/class.dto.js';

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListClassesQueryDto) {
    return this.classes.list(user, q);
  }

  // Declared before ':id' so "upcoming" is not parsed as an id.
  @Get('upcoming')
  upcoming(@CurrentUser() user: AuthUser) {
    return this.classes.upcoming(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.classes.get(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClassDto) {
    return this.classes.create(user, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classes.update(user, id, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Delete(':id')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.classes.cancel(user, id);
  }

  @Roles(Role.STUDENT)
  @Post(':id/join')
  join(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.classes.join(user, id);
  }

  @Roles(Role.STUDENT)
  @Post(':id/leave')
  leave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.classes.leave(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id/attendance')
  attendance(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.classes.attendance(user, id);
  }
}
