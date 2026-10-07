import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

// Reports and CSV exports live in ../reports. Plan + checklist: docs/07-admin-dashboard.md
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
