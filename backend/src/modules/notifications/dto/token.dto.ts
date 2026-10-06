import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  /** Omit / null to stop pushes for this device (e.g. notifications turned off). */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  fcmToken?: string | null;
}
