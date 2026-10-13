import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { StorageService } from './storage.service.js';
import { VideoStoreService } from './video-store.service.js';

// Plan + checklist: docs/04-notes-study-material.md
@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService, VideoStoreService],
  exports: [StorageService, VideoStoreService],
})
export class StorageModule {}
