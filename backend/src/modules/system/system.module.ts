import { Module } from '@nestjs/common';
import { SystemController } from './system.controller.js';
import { SystemService } from './system.service.js';

// Disk space, push and email health for the admin dashboard, plus the daily disk alert.
@Module({
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
