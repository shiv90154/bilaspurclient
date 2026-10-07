import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { OtpService } from './otp.service.js';

// Self-registration + forgot password, both with email OTP.
@Module({
  controllers: [AccountController],
  providers: [AccountService, OtpService],
})
export class AccountModule {}
