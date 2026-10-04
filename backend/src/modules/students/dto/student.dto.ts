import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { Gender, StudentStatus } from '../../../generated/prisma/enums.js';

const PHONE_RE = /^[6-9]\d{9}$/;

export class AcademicDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  prevSchool?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prevClass?: string;

  @ApiPropertyOptional({ description: 'Percentage 0-100' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  prevMarks?: number;

  @ApiPropertyOptional({ example: 'NEET' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetExam?: string;
}

class StudentProfileFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  admissionNo?: string;

  @ApiPropertyOptional({ example: '2008-04-12' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE_RE, { message: 'guardianPhone must be a 10 digit mobile number' })
  guardianPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateStudentDto extends StudentProfileFields {
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

  @ApiPropertyOptional({ enum: StudentStatus, default: StudentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiPropertyOptional({ type: AcademicDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicDto)
  academic?: AcademicDto;

  @ApiPropertyOptional({ description: 'Batches to enrol the student in' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  batchIds?: string[];
}

export class UpdateStudentDto extends StudentProfileFields {
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

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiPropertyOptional({ type: AcademicDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicDto)
  academic?: AcademicDto;
}

export class ListStudentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name, phone or admission no' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class AssignBatchDto {
  @ApiProperty()
  @IsUUID()
  batchId!: string;
}
