import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Platform } from '../../../generated/prisma/enums.js';

export class LoginDto {
  @ApiProperty({ description: 'Phone number or email', example: '9999999997' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  identifier!: string;

  @ApiProperty({ example: 'Demo@12345' })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    description: 'Stable device id. Required for students (one-device rule).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'Samsung SM-A546E' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional({ enum: Platform, default: Platform.WEB })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;
}
