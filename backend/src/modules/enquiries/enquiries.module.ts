import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module.js';
import { EnquiriesController } from './enquiries.controller.js';
import { EnquiriesService } from './enquiries.service.js';

// Plan + checklist: docs/01-student-management.md
@Module({
  imports: [StudentsModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService],
})
export class EnquiriesModule {}
