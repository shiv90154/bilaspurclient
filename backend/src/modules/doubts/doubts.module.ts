import { Module } from '@nestjs/common';
import { DoubtsController } from './doubts.controller.js';
import { DoubtsService } from './doubts.service.js';

// Plan + checklist: docs/05-student-doubts.md
@Module({
  controllers: [DoubtsController],
  providers: [DoubtsService],
  exports: [DoubtsService],
})
export class DoubtsModule {}
