import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { DeletionRequestStatus } from '../../../generated/prisma/enums.js';

export class ConsentDto {
  @ApiProperty({ description: 'The terms version shown to the student (from /privacy/info)' })
  @IsString()
  @MaxLength(20)
  version!: string;

  @ApiProperty({ description: 'The student agrees to the terms and privacy policy' })
  @IsBoolean()
  @Equals(true, { message: 'Please accept the terms and privacy policy' })
  accepted!: boolean;

  @ApiPropertyOptional({ description: 'For students under 18: the parent/guardian agrees too' })
  @IsOptional()
  @IsBoolean()
  guardianAgree?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;
}

export class AppDeletionRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class WebDeletionRequestDto extends AppDeletionRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '9876543210' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter the 10 digit mobile number you log in with' })
  phone!: string;
}

export class ListDeletionRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DeletionRequestStatus })
  @IsOptional()
  @IsEnum(DeletionRequestStatus)
  status?: DeletionRequestStatus;
}

export class HandleDeletionRequestDto {
  @ApiPropertyOptional({ description: 'Shown in the log, e.g. why a request was rejected' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
