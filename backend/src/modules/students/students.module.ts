import { Module } from '@nestjs/common';
import { StudentFilesService } from './student-files.service.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

// Plan + checklist: docs/01-student-management.md
@Module({
  controllers: [StudentsController],
  providers: [StudentsService, StudentFilesService],
  exports: [StudentsService],
})
export class StudentsModule {}
