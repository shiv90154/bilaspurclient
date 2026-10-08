import { Module } from '@nestjs/common';
import { FeesController } from './fees.controller.js';
import { FeesService } from './fees.service.js';
import { RazorpayService } from './razorpay.service.js';

// Fee plans, Razorpay on the website, offline entries, receipts.
// Plan + checklist: docs/12-website-fees-payments.md
@Module({
  controllers: [FeesController],
  providers: [FeesService, RazorpayService],
})
export class FeesModule {}
