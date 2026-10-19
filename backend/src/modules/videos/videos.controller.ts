import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateVideoDto, ListVideosQueryDto, StartVideoUploadDto, UpdateVideoDto } from './dto/video.dto.js';
import { VideosService } from './videos.service.js';

@ApiTags('videos')
@ApiBearerAuth()
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListVideosQueryDto) {
    return this.videos.list(user, q);
  }

  /** A link to play now (own files: signed for a few hours). */
  @Get(':id/play')
  play(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.videos.play(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVideoDto) {
    return this.videos.create(user, dto);
  }

  /** Our own mp4: start, then PUT chunks of up to `chunkBytes` at `?offset=`, then complete. */
  @Roles(Role.ADMIN, Role.FACULTY)
  @Post('uploads')
  startUpload(@CurrentUser() user: AuthUser, @Body() dto: StartVideoUploadDto) {
    return this.videos.startUpload(user, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Put('uploads/:id')
  @ApiConsumes('application/octet-stream')
  appendChunk(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('offset', ParseIntPipe) offset: number,
    @Req() req: Request,
  ) {
    return this.videos.appendChunk(user, id, offset, req);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post('uploads/:id/complete')
  completeUpload(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.videos.completeUpload(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVideoDto) {
    return this.videos.update(user, id, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.videos.remove(user, id);
  }
}
