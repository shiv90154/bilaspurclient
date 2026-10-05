import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { CurriculumController } from './curriculum.controller.js';
import { CurriculumService } from './curriculum.service.js';

// Plan + checklist: docs/01-student-management.md
@Module({
  controllers: [CoursesController, CurriculumController],
  providers: [CoursesService, CurriculumService],
  exports: [CoursesService, CurriculumService],
})
export class CoursesModule {}
