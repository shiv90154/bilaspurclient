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
import {
  CreateFacultyDto,
  ListFacultyQueryDto,
  UpdateFacultyDto,
} from './dto/faculty.dto.js';
import { FacultyService } from './faculty.service.js';

@ApiTags('faculty')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('faculty')
export class FacultyController {
  constructor(private readonly faculty: FacultyService) {}

  @Get()
  list(@Query() q: ListFacultyQueryDto) {
    return this.faculty.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.faculty.get(id);
  }

  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateFacultyDto) {
    return this.faculty.create(admin, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFacultyDto,
  ) {
    return this.faculty.update(admin, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.faculty.remove(admin, id);
  }
}
