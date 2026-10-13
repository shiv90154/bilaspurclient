import { Module } from '@nestjs/common';
import { RecordingImportService } from './recording-import.service.js';
import { ZoomApiService } from './zoom-api.service.js';
import { ZoomController } from './zoom.controller.js';

// Zoom cloud recordings → video store → the class's batch. Setup: docs/14-zoom-recordings.md
@Module({
  controllers: [ZoomController],
  providers: [ZoomApiService, RecordingImportService],
})
export class ZoomModule {}
