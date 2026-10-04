import { Module } from '@nestjs/common';
import { FacultyController } from './faculty.controller.js';
import { FacultyService } from './faculty.service.js';

// Plan + checklist: docs/06-role-based-access.md
@Module({
  controllers: [FacultyController],
  providers: [FacultyService],
  exports: [FacultyService],
})
export class FacultyModule {}
