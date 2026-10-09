import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Show the student name + phone watermark in the app' })
  @IsOptional()
  @IsBoolean()
  watermarkEnabled?: boolean;

  @ApiPropertyOptional({ description: 'App refuses to run while Developer options / USB debugging are on' })
  @IsOptional()
  @IsBoolean()
  blockDeveloperOptions?: boolean;

  @ApiPropertyOptional({ description: 'Institute name on the privacy policy and terms' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  instituteName?: string;

  @ApiPropertyOptional({ description: 'Contact email for privacy questions and deletion requests' })
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsEmail()
  @MaxLength(150)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^[0-9+\- ]{6,20}$/, { message: 'contactPhone must be a phone number' })
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ description: 'Maintenance mode: website, student panel and app show a maintenance screen' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ description: 'Note on the maintenance screen, e.g. "Back by 6 pm"' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  maintenanceMessage?: string;
}
