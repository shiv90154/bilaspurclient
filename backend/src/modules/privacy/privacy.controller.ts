import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  AppDeletionRequestDto,
  ConsentDto,
  HandleDeletionRequestDto,
  ListDeletionRequestsQueryDto,
  WebDeletionRequestDto,
} from './dto/privacy.dto.js';
import { PrivacyService } from './privacy.service.js';

@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  /** Institute name/contact + current terms version, for the public legal pages and the app. */
  @Public()
  @Get('info')
  info() {
    return this.privacy.info();
  }

  @ApiBearerAuth()
  @Roles(Role.STUDENT)
  @Post('consent')
  consent(@CurrentUser() user: AuthUser, @Body() dto: ConsentDto, @Req() req: Request) {
    return this.privacy.consent(user, dto, req.ip);
  }

  @ApiBearerAuth()
  @Roles(Role.STUDENT)
  @Get('deletion-request')
  mine(@CurrentUser() user: AuthUser) {
    return this.privacy.myRequest(user);
  }

  @ApiBearerAuth()
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('deletion-request')
  requestFromApp(@CurrentUser() user: AuthUser, @Body() dto: AppDeletionRequestDto) {
    return this.privacy.requestFromApp(user, dto.reason);
  }

  /** Public form at admin-web /delete-account. */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('deletion-request/public')
  requestFromWeb(@Body() dto: WebDeletionRequestDto) {
    return this.privacy.requestFromWeb(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('deletion-requests')
  list(@Query() q: ListDeletionRequestsQueryDto) {
    return this.privacy.list(q);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post('deletion-requests/:id/complete')
  complete(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HandleDeletionRequestDto,
  ) {
    return this.privacy.complete(admin, id, dto.note);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post('deletion-requests/:id/reject')
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HandleDeletionRequestDto,
  ) {
    return this.privacy.reject(admin, id, dto.note);
  }
}
