import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { PaymentMode, PaymentStatus } from '../../../generated/prisma/enums.js';

export class CreateFeePlanDto {
  @ApiProperty({ example: 'BAMS 1st Prof: full course' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Batch the student joins after paying (its course is taken from it)' })
  @IsUUID()
  batchId!: string;

  @ApiProperty({ example: 4999, description: 'Price in rupees, GST included' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  total!: number;

  @ApiPropertyOptional({ example: 7999, description: 'Original price shown struck through (0 = none)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  mrp?: number;

  @ApiPropertyOptional({ example: 3999, description: 'Offer price students pay while the offer runs (0 = no offer)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  offerPrice?: number;

  @ApiPropertyOptional({ example: 'Diwali offer', description: 'Badge shown with the offer price' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  offerLabel?: string;

  @ApiPropertyOptional({ example: '2026-11-01T18:29:59.000Z', description: 'When the offer ends ("" = no end date)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsISO8601()
  offerEndsAt?: string;
}

export class UpdateFeePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  total?: number;

  @ApiPropertyOptional({ example: 7999, description: 'Original price shown struck through (0 = none)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  mrp?: number;

  @ApiPropertyOptional({ example: 3999, description: 'Offer price students pay while the offer runs (0 = no offer)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  offerPrice?: number;

  @ApiPropertyOptional({ example: 'Diwali offer', description: 'Badge shown with the offer price' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  offerLabel?: string;

  @ApiPropertyOptional({ example: '2026-11-01T18:29:59.000Z', description: 'When the offer ends ("" = no end date)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsISO8601()
  offerEndsAt?: string;

  @ApiPropertyOptional({ description: 'Shown on the website and open for online payment' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @Matches(/^order_[A-Za-z0-9]{6,40}$/)
  razorpay_order_id!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^pay_[A-Za-z0-9]{6,40}$/)
  razorpay_payment_id!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  razorpay_signature!: string;
}

export const OFFLINE_MODES = [PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CHEQUE, PaymentMode.BANK_TRANSFER] as const;

export class OfflinePaymentDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiProperty({ example: 4999 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  amount!: number;

  @ApiProperty({ enum: OFFLINE_MODES })
  @IsIn(OFFLINE_MODES)
  mode!: (typeof OFFLINE_MODES)[number];

  @ApiPropertyOptional({ description: 'UPI ref / cheque no. / any note' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({ description: 'Open the batch now even if this is only part of the fee', default: false })
  @IsOptional()
  @IsBoolean()
  grantAccess?: boolean;
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  mode?: PaymentMode;

  @ApiPropertyOptional({ description: 'Student name, phone or receipt number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
