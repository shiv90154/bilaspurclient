import { Global, Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';

// Global: auth asks it whether a student still has to accept the terms.
// Plan + checklist: docs/13-play-store-compliance.md
@Global()
@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
