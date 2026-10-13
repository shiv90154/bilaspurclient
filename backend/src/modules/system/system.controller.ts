import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import { SystemService } from './system.service.js';

export class TestPushDto {
  @ApiPropertyOptional({ description: 'Phone or email of the user to notify. Empty = yourself.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  identifier?: string;
}

@ApiTags('system')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('status')
  status() {
    return this.system.status();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('test-push')
  testPush(@CurrentUser() user: AuthUser, @Body() dto: TestPushDto) {
    return this.system.testPush(user, dto.identifier);
  }
}
