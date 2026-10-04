import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { BatchesService } from './batches.service.js';
import {
  CreateBatchDto,
  ListBatchesQueryDto,
  SetBatchFacultyDto,
  UpdateBatchDto,
} from './dto/batch.dto.js';

@ApiTags('batches')
@ApiBearerAuth()
@Controller('batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListBatchesQueryDto) {
    return this.batches.list(user, q);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.batches.get(user, id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateBatchDto) {
    return this.batches.create(admin, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBatchDto,
  ) {
    return this.batches.update(admin, id, dto);
  }

  @Roles(Role.ADMIN)
  @Put(':id/faculty')
  setFaculty(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBatchFacultyDto,
  ) {
    return this.batches.setFaculty(admin, id, dto.facultyIds);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  archive(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.batches.archive(admin, id);
  }
}
