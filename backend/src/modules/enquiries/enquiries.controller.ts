import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  ConvertEnquiryDto,
  CreateEnquiryDto,
  ListEnquiriesQueryDto,
  UpdateEnquiryDto,
} from './dto/enquiry.dto.js';
import { EnquiriesService } from './enquiries.service.js';

@ApiTags('enquiries')
@ApiBearerAuth()
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get()
  list(@Query() q: ListEnquiriesQueryDto) {
    return this.enquiries.list(q);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.enquiries.get(id);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEnquiryDto) {
    return this.enquiries.create(user, dto);
  }

  @Roles(Role.ADMIN, Role.FACULTY)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnquiryDto,
  ) {
    return this.enquiries.update(user, id, dto);
  }

  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post(':id/convert')
  convert(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertEnquiryDto,
  ) {
    return this.enquiries.convert(admin, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.enquiries.remove(admin, id);
  }
}
