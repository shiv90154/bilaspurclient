import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DocumentType } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/**
 * What a student may change on their own profile. Name, phone, date of birth, admission no. and
 * batches stay with the institute: they identify the student in every record.
 * An empty string clears the field.
 */
export class UpdateMyProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @ApiPropertyOptional({ description: '10 digit mobile number, or empty to clear' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^([6-9]\d{9})?$/, { message: 'Guardian phone must be a 10 digit mobile number' })
  guardianPhone?: string;
}

export class ChangeEmailStartDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(150)
  email!: string;
}

export class ChangeEmailVerifyDto extends ChangeEmailStartDto {
  @ApiProperty({ example: '123456' })
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code!: string;
}

/** Push kinds a student can switch off. Class cancelled / rescheduled always arrive. */
export class NotificationPrefsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() classReminders?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() recordings?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() doubtReplies?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() testResults?: boolean;
}

export class UploadMyDocumentDto {
  @ApiProperty({ enum: [DocumentType.ID_PROOF, DocumentType.MARKSHEET, DocumentType.OTHER] })
  @IsEnum([DocumentType.ID_PROOF, DocumentType.MARKSHEET, DocumentType.OTHER], {
    message: 'Choose ID proof, marksheet or other',
  })
  type!: DocumentType;

  @ApiPropertyOptional({ description: 'e.g. "Aadhaar card"' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  label?: string;
}

export class ReviewDocumentDto {
  @ApiPropertyOptional({ description: 'Reason shown to the student when rejected' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}
