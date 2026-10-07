import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id/devices')
  devices(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.listDevices(id);
  }

  @HttpCode(200)
  @Post(':id/reset-device')
  resetDevice(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.resetDevices(admin, id);
  }

  /** Sets a new password (or generates one, returned once) and logs the user out everywhere. */
  @HttpCode(200)
  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(admin, id, dto.password);
  }
}
