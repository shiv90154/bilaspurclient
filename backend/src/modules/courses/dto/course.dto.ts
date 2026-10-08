import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export class CourseFaqDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  q!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  a!: string;
}

/** Fields of the public course page (all optional, shared by create and update). */
export class CoursePageDto {
  @ApiPropertyOptional({ example: 'Crack AIAPGET with concept-first preparation' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @ApiPropertyOptional({ example: 'Hindi + English' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;

  @ApiPropertyOptional({ example: '12 months' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  duration?: string;

  @ApiPropertyOptional({ type: [String], description: "What you'll learn" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  highlights?: string[];

  @ApiPropertyOptional({ type: [String], description: 'This course includes' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  includes?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Who this course is for' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  audience?: string[];

  @ApiPropertyOptional({ type: [CourseFaqDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CourseFaqDto)
  faqs?: CourseFaqDto[];
}

export class CreateCourseDto extends CoursePageDto {
  @ApiProperty({ example: 'NEET 2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateCourseDto extends CoursePageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListCoursesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  // Query strings are text: "false" must not become true via Boolean("false").
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  active?: boolean;
}
