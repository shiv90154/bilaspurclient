import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../../auth/dto/change-password.dto.js';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const OTP_RULE = /^\d{6}$/;

export class RegisterStartDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '9876543210' })
  @Transform(trim)
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a 10 digit mobile number' })
  phone!: string;

  @ApiProperty()
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(150)
  email!: string;

  @ApiProperty({ description: PASSWORD_RULE_MESSAGE })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  password!: string;

  @ApiPropertyOptional({ description: 'Course the student wants to join (from GET /courses/public). The app does not ask for it (Play policy: no course list in the app).' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ enum: ['APP', 'WEB'], default: 'APP' })
  @IsOptional()
  @IsIn(['APP', 'WEB'])
  via?: 'APP' | 'WEB';
}

export class RegisterVerifyDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @Matches(OTP_RULE, { message: 'Enter the 6 digit code from the email' })
  code!: string;
}

export class ResendDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Phone number or email of the account' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  identifier!: string;
}

export class ResetPasswordWithOtpDto extends ForgotPasswordDto {
  @ApiProperty({ example: '123456' })
  @Matches(OTP_RULE, { message: 'Enter the 6 digit code from the email' })
  code!: string;

  @ApiProperty({ description: PASSWORD_RULE_MESSAGE })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}
