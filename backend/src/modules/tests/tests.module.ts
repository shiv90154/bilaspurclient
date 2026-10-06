import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service.js';
import { SeriesController } from './series.controller.js';
import { SeriesService } from './series.service.js';
import { AttemptsController, TestsController } from './tests.controller.js';
import { TestsService } from './tests.service.js';

// Plan + checklist: docs/02-question-bank.md
@Module({
  controllers: [TestsController, AttemptsController, SeriesController],
  providers: [TestsService, AttemptsService, SeriesService],
  exports: [TestsService, AttemptsService],
})
export class TestsModule {}
