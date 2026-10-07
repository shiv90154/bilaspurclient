import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { AccountService } from './account.service.js';
import {
  ForgotPasswordDto,
  RegisterStartDto,
  RegisterVerifyDto,
  ResendDto,
  ResetPasswordWithOtpDto,
} from './dto/account.dto.js';

/** Sign-up and forgot password. All public; every route is rate limited per IP. */
@ApiTags('account')
@Public()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('courses')
  courses() {
    return this.account.publicCourses();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('register/start')
  registerStart(@Body() dto: RegisterStartDto) {
    return this.account.registerStart(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('register/resend')
  registerResend(@Body() dto: ResendDto) {
    return this.account.registerResend(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('register/verify')
  registerVerify(@Body() dto: RegisterVerifyDto) {
    return this.account.registerVerify(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/forgot')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.account.forgot(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/reset')
  reset(@Body() dto: ResetPasswordWithOtpDto) {
    return this.account.reset(dto);
  }
}
