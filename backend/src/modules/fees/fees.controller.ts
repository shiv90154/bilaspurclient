import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  CreateFeePlanDto,
  CreateOrderDto,
  ListPaymentsQueryDto,
  OfflinePaymentDto,
  UpdateFeePlanDto,
  VerifyPaymentDto,
} from './dto/fees.dto.js';
import { FeesService } from './fees.service.js';

/** Fee plans (what the website sells) and payments. Website only: the app shows no prices. */
@ApiTags('fees')
@ApiBearerAuth()
@Controller()
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  // ── plans ──

  @Public()
  @Get('fee-plans/public')
  publicPlans() {
    return this.fees.publicPlans();
  }

  @Roles(Role.STUDENT)
  @Get('fee-plans/mine')
  plansForMe(@CurrentUser() user: AuthUser) {
    return this.fees.plansForStudent(user);
  }

  @Roles(Role.ADMIN)
  @Get('fee-plans')
  listPlans() {
    return this.fees.listPlans();
  }

  @Roles(Role.ADMIN)
  @Post('fee-plans')
  createPlan(@CurrentUser() admin: AuthUser, @Body() dto: CreateFeePlanDto) {
    return this.fees.createPlan(admin, dto);
  }

  @Roles(Role.ADMIN)
  @Patch('fee-plans/:id')
  updatePlan(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeePlanDto) {
    return this.fees.updatePlan(admin, id, dto);
  }

  // ── online payment ──

  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('payments/razorpay/order')
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.fees.createOrder(user, dto.planId);
  }

  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('payments/razorpay/verify')
  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) {
    return this.fees.verify(user, dto);
  }

  /** Called by Razorpay's servers (signed with the webhook secret), never by a browser. */
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('payments/razorpay/webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.fees.webhook(req.rawBody, signature, eventId);
  }

  // ── offline entries and lists ──

  @Roles(Role.ADMIN)
  @Post('payments/offline')
  recordOffline(@CurrentUser() admin: AuthUser, @Body() dto: OfflinePaymentDto) {
    return this.fees.recordOffline(admin, dto);
  }

  @Roles(Role.ADMIN)
  @Get('payments')
  list(@Query() q: ListPaymentsQueryDto) {
    return this.fees.list(q);
  }

  @Roles(Role.STUDENT)
  @Get('payments/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.fees.mine(user);
  }

  @Roles(Role.ADMIN, Role.STUDENT)
  @Get('payments/:id')
  payment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fees.payment(user, id);
  }
}
