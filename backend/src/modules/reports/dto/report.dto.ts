import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DateRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'From this day (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Up to this day (inclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AttendanceReportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;
}

export class StudentAttendanceQueryDto extends DateRangeQueryDto {
  @ApiProperty()
  @IsUUID()
  batchId!: string;
}
