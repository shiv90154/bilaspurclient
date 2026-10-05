import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { DoubtsService } from './doubts.service.js';
import {
  AssignDoubtDto,
  CreateDoubtDto,
  ListDoubtsQueryDto,
  PostMessageDto,
} from './dto/doubt.dto.js';

@ApiTags('doubts')
@ApiBearerAuth()
@Controller('doubts')
export class DoubtsController {
  constructor(private readonly doubts: DoubtsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListDoubtsQueryDto) {
    return this.doubts.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.doubts.get(user, id);
  }

  @Roles(Role.STUDENT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDoubtDto) {
    return this.doubts.create(user, dto);
  }

  @Post(':id/messages')
  post(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.doubts.postMessage(user, id, dto.text);
  }

  @Roles(Role.ADMIN)
  @Post(':id/assign')
  assign(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDoubtDto,
  ) {
    return this.doubts.assign(admin, id, dto.facultyUserId);
  }

  @Post(':id/resolve')
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.doubts.setResolved(user, id, true);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.doubts.setResolved(user, id, false);
  }
}
