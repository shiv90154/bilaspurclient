import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../../auth/dto/change-password.dto.js';

export class ResetPasswordDto {
  @ApiPropertyOptional({ description: 'Leave out to generate a random password (shown once)' })
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  password?: string;
}
