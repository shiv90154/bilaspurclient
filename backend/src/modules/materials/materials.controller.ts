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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  CreateMaterialDto,
  ListMaterialsQueryDto,
  UpdateMaterialDto,
} from './dto/material.dto.js';
import {
  MAX_UPLOAD_BYTES,
  MaterialsService,
  type UploadedFile as UploadedPdf,
} from './materials.service.js';

const upload = FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

@ApiTags('materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListMaterialsQueryDto) {
    return this.materials.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materials.get(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload)
  create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() dto: CreateMaterialDto,
  ) {
    return this.materials.create(user, file, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post(':id/replace')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload)
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedPdf | undefined,
  ) {
    return this.materials.replace(user, id, file);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materials.update(user, id, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Delete(':id')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materials.archive(user, id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id/views')
  views(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materials.views(user, id);
  }

  @Get(':id/view-url')
  viewUrl(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materials.viewUrl(user, id);
  }

  @Get(':id/download-url')
  downloadUrl(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materials.downloadUrl(user, id);
  }
}
