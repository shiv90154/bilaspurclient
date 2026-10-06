import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateSeriesDto, SeriesService, UpdateSeriesDto } from './series.service.js';

@ApiTags('test-series')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FACULTY)
@Controller('test-series')
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  list(@Query('all') all?: string) {
    return this.series.list(all === 'true');
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSeriesDto) {
    return this.series.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSeriesDto) {
    return this.series.update(user, id, dto);
  }
}
