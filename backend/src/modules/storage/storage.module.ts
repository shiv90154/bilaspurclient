import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { StorageService } from './storage.service.js';

// Plan + checklist: docs/04-notes-study-material.md
@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
