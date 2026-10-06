import { Global, Module } from '@nestjs/common';
import { ClassRemindersService } from './class-reminders.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

// Global so classes/doubts can push without importing this module everywhere.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ClassRemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
