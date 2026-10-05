import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: 'Physics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class CreateTopicDto {
  @ApiProperty()
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: 'Kinematics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}

export class RenameDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}

export class ListSubjectsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
