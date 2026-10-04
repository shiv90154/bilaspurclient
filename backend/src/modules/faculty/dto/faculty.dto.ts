import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { UserStatus } from '../../../generated/prisma/enums.js';

const PHONE_RE = /^[6-9]\d{9}$/;

class FacultyProfileFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}

export class CreateFacultyDto extends FacultyProfileFields {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '9876543210' })
  @Matches(PHONE_RE, { message: 'phone must be a 10 digit mobile number' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    description: 'Initial password. If omitted a random one is generated and returned once.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  subjectIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  batchIds?: string[];
}

export class UpdateFacultyDto extends FacultyProfileFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE_RE, { message: 'phone must be a 10 digit mobile number' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Replaces the current subject list' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({ description: 'Replaces the current batch list' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  batchIds?: string[];
}

export class ListFacultyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
