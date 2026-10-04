import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { EnquiryStatus } from '../../../generated/prisma/enums.js';

const PHONE_RE = /^[6-9]\d{9}$/;

export class CreateEnquiryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseInterestId?: string;

  @ApiPropertyOptional({ example: 'Walk-in' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: '2026-10-10' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Staff user (admin/faculty) handling this lead' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class UpdateEnquiryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseInterestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ enum: EnquiryStatus, description: 'CONVERTED is set only by the convert endpoint' })
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class ListEnquiriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: EnquiryStatus })
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @ApiPropertyOptional({ description: 'Only follow-ups due on or before this date' })
  @IsOptional()
  @IsDateString()
  followUpBefore?: string;
}

export class ConvertEnquiryDto {
  @ApiPropertyOptional({ description: 'Batch to enrol the new student in' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Initial password; random one is generated if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
