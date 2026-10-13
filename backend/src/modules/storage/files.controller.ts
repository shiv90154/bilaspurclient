import { Controller, Get, Headers, NotFoundException, Param, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { CONTENT_TYPES, StorageService, type StoredExt } from './storage.service.js';

/**
 * Serves files for signed, expiring links only. Authorization already happened when the link was
 * issued (batch membership, download flag), so this route needs no JWT, which lets a PDF viewer open it.
 */
@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(':key')
  async serve(
    @Param('key') key: string,
    @Query('exp') exp: string,
    @Query('d') disposition: string,
    @Query('n') name: string,
    @Query('sig') sig: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.storage.isValidKey(key)) throw new NotFoundException();
    if (!this.storage.verify(key, Number(exp), disposition, name ?? '', sig ?? '')) {
      throw new UnauthorizedException('Link expired or invalid');
    }
    let size;
    try {
      size = await this.storage.size(key);
    } catch {
      throw new NotFoundException();
    }
    // Video players seek with "Range: bytes=start-end"; one range is all they ask for.
    const range = parseRange(rangeHeader, size);
    if (range === 'invalid') {
      res.status(416).set('Content-Range', `bytes */${size}`).end();
      return;
    }
    const file = await this.storage.open(key, range ?? undefined);
    const safeName = (name || (key.endsWith('.apk') ? 'app.apk' : 'file.pdf')).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    if (range) res.status(206).set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.set({
      'Content-Type': CONTENT_TYPES[key.slice(key.lastIndexOf('.') + 1) as StoredExt],
      'Content-Length': String(range ? range.end - range.start + 1 : size),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // Helmet defaults to same-origin; the admin/student web embeds this from another origin.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    file.stream.pipe(res);
  }
}

/** null = no (usable) Range header, serve everything; 'invalid' = 416. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    // "bytes=-500": the last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}
