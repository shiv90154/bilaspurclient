import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { DoubtStatus } from '../../../generated/prisma/enums.js';

export class CreateDoubtDto {
  @ApiProperty({ example: 'Why is the net force zero here?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'First message of the thread' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Seconds into the class / premiere' })
  @IsOptional()
  @IsInt()
  @Min(0)
  classTimestamp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class PostMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}

export class AssignDoubtDto {
  @ApiProperty({ description: 'User id of the faculty member' })
  @IsUUID()
  facultyUserId!: string;
}

export class ListDoubtsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DoubtStatus })
  @IsOptional()
  @IsEnum(DoubtStatus)
  status?: DoubtStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
