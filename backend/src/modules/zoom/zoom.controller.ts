import { Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsEnum, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { RecordingImportStatus, Role } from '../../generated/prisma/enums.js';
import { RecordingImportService } from './recording-import.service.js';

export class ListImportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RecordingImportStatus })
  @IsOptional()
  @IsEnum(RecordingImportStatus)
  status?: RecordingImportStatus;
}

@ApiTags('zoom')
@ApiBearerAuth()
@Controller()
export class ZoomController {
  constructor(private readonly imports: RecordingImportService) {}

  /** Called by Zoom's servers (signed with the app's secret token), never by a browser. */
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('integrations/zoom/webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-zm-request-timestamp') timestamp?: string,
    @Headers('x-zm-signature') signature?: string,
  ) {
    return this.imports.webhook(req.rawBody, timestamp, signature);
  }

  @Roles(Role.ADMIN)
  @Get('integrations/zoom/status')
  status() {
    return this.imports.status();
  }

  @Roles(Role.ADMIN)
  @Get('integrations/zoom/imports')
  list(@Query() q: ListImportsQueryDto) {
    return this.imports.list(q);
  }

  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post('integrations/zoom/imports/:id/retry')
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.retry(user, id);
  }

  /** Asks Zoom now instead of waiting for the webhook / hourly sweep. */
  @Roles(Role.ADMIN, Role.FACULTY)
  @HttpCode(200)
  @Post('classes/:id/fetch-recording')
  fetch(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.fetchForClass(user, id);
  }
}
