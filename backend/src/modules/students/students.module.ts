import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module.js';
import { StudentSelfService } from './student-self.service.js';
import { StudentFilesService } from './student-files.service.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

// Plan + checklist: docs/01-student-management.md
@Module({
  imports: [AccountModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentFilesService, StudentSelfService],
  exports: [StudentsService],
})
export class StudentsModule {}
