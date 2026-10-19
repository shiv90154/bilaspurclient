import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

// Recorded lectures: a link (YouTube unlisted / Drive) or our own mp4 (chunked admin upload or a Zoom
// import), free demo or per batch. Still TODO: encrypted HLS + progress (docs/11-recorded-lectures.md).
@Module({
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
