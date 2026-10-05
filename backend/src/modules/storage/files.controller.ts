import { Controller, Get, NotFoundException, Param, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { StorageService } from './storage.service.js';

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
    @Res() res: Response,
  ) {
    if (!this.storage.isValidKey(key)) throw new NotFoundException();
    if (!this.storage.verify(key, Number(exp), disposition, name ?? '', sig ?? '')) {
      throw new UnauthorizedException('Link expired or invalid');
    }
    let file;
    try {
      file = await this.storage.open(key);
    } catch {
      throw new NotFoundException();
    }
    const safeName = (name || (key.endsWith('.apk') ? 'app.apk' : 'file.pdf')).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    res.set({
      'Content-Type': key.endsWith('.apk') ? 'application/vnd.android.package-archive' : 'application/pdf',
      'Content-Length': String(file.size),
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // Helmet defaults to same-origin; the admin/student web embeds this from another origin.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    file.stream.pipe(res);
  }
}
