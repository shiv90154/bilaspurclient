import { Module } from '@nestjs/common';
import { TestsModule } from '../tests/tests.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

// Plan + checklist: docs/07-admin-dashboard.md (Reports)
@Module({
  imports: [TestsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
