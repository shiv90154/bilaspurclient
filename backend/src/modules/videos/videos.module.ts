import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

// Link-based recorded lectures (YouTube unlisted / Drive), free demo or per batch.
// Still TODO: own upload + encrypted HLS + progress (docs/11-recorded-lectures.md).
@Module({
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
