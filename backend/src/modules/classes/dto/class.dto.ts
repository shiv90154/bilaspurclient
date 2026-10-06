import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { ClassStatus } from '../../../generated/prisma/enums.js';

/** Only the types that exist in V1. OWN_LIVE (BBB/LiveKit) comes later. */
export enum CreatableClassType {
  ZOOM = 'ZOOM',
  PREMIERE = 'PREMIERE',
}

// https only: a stored "javascript:" or "intent:" link would run on the student's phone.
const URL_RULES = { protocols: ['https'], require_protocol: true };

export class CreateClassDto {
  @ApiProperty()
  @IsUUID()
  batchId!: string;

  @ApiProperty({ example: 'Physics: Kinematics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ enum: CreatableClassType, default: CreatableClassType.ZOOM })
  @IsOptional()
  @IsEnum(CreatableClassType)
  type?: CreatableClassType;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ description: 'Zoom / Meet link (required for ZOOM)' })
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(500)
  joinUrl?: string;

  @ApiPropertyOptional({ description: 'Recorded video to play as live (PREMIERE)' })
  @IsOptional()
  @IsUUID()
  videoId?: string;

  @ApiPropertyOptional({ description: 'Faculty record id. Faculty users default to themselves.' })
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'Repeat every week on the same weekday until this date (max 60 classes)' })
  @IsOptional()
  @IsDateString()
  repeatWeeklyUntil?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_RULES)
  @MaxLength(500)
  joinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facultyId?: string;
}

export class ListClassesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc', description: 'By start time' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Classes starting on/after this time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Classes starting before this time' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ClassStatus })
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;
}
