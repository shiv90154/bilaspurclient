import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { TestStatus } from '../../../generated/prisma/enums.js';

export class CreateTestDto {
  @ApiPropertyOptional({ description: "Test series this test belongs to (null removes it)" })
  @IsOptional()
  @IsUUID()
  seriesId?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiProperty({ description: 'Minutes' })
  @IsInt()
  @Min(1)
  @Max(600)
  durationMin!: number;

  @ApiPropertyOptional({ description: 'Marks deducted per wrong answer', example: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99)
  negativeMark?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional({ description: 'Window opens' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: 'Window closes (attempts auto-submit then)' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class UpdateTestDto {
  @ApiPropertyOptional({ description: "Test series this test belongs to (null removes it)" })
  @IsOptional()
  @IsUUID()
  seriesId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  durationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99)
  negativeMark?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class TestQuestionDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(100)
  marks?: number;
}

export class SetTestQuestionsDto {
  @ApiProperty({ type: [TestQuestionDto], description: 'Full ordered list; replaces the current one' })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => TestQuestionDto)
  questions!: TestQuestionDto[];
}

export class SetTestBatchesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  batchIds!: string[];
}

export class ListTestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @ApiPropertyOptional({ enum: TestStatus })
  @IsOptional()
  @IsEnum(TestStatus)
  status?: TestStatus;
}

export class SaveAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty({ type: [String], description: 'Empty array clears the answer' })
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('all', { each: true })
  selectedOptionIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  markedForReview?: boolean;
}

export class SaveAnswersDto {
  @ApiProperty({ type: [SaveAnswerDto] })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => SaveAnswerDto)
  answers!: SaveAnswerDto[];
}

export class SetTestDemoDto {
  @ApiProperty({ description: 'Free demo test: every student (also not yet approved ones) can take it' })
  @IsBoolean()
  isDemo!: boolean;
}
