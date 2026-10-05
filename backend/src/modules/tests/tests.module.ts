import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service.js';
import { AttemptsController, TestsController } from './tests.controller.js';
import { TestsService } from './tests.service.js';

// Plan + checklist: docs/02-question-bank.md
@Module({
  controllers: [TestsController, AttemptsController],
  providers: [TestsService, AttemptsService],
  exports: [TestsService, AttemptsService],
})
export class TestsModule {}
