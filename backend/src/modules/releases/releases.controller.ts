import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { MAX_APK_BYTES, ReleasesService, type UploadedApk } from './releases.service.js';

class CreateReleaseDto {
  @ApiProperty({ example: '1.0.3' })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+([-+][\w.]+)?$/, { message: 'version must look like 1.0.3' })
  @MaxLength(30)
  version!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

@ApiTags('app-releases')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('app-releases')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list() {
    return this.releases.list();
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_APK_BYTES, files: 1 } }))
  create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedApk | undefined,
    @Body() dto: CreateReleaseDto,
  ) {
    return this.releases.create(user, file, dto.version, dto.notes);
  }

  /** The public website's "Download app" button: newest APK, no login. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('latest/download-url')
  latestDownloadUrl() {
    return this.releases.latestDownloadUrl();
  }

  /** The app's "update available" check: newest version number and its notes, no login. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('latest')
  latest() {
    return this.releases.latestInfo();
  }

  @Get(':id/download-url')
  downloadUrl(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.releases.downloadUrl(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.releases.remove(user, id);
  }
}
