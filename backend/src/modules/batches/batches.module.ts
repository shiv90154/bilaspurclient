import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';

// Plan + checklist: docs/01-student-management.md
@Module({
  controllers: [BatchesController],
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
