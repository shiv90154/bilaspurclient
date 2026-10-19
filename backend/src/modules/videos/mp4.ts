import { open } from 'node:fs/promises';

/**
 * Checks that a file is an mp4 (an `ftyp` box first) and reads its duration from `moov/mvhd`,
 * walking the box headers so a multi-GB lecture is never loaded into memory.
 */
export async function mp4Info(path: string): Promise<{ isMp4: boolean; durationSec: number | null }> {
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    const read = async (pos: number, len: number) => {
      const buf = Buffer.alloc(len);
      const { bytesRead } = await fh.read(buf, 0, len, pos);
      return buf.subarray(0, bytesRead);
    };

    const first = await read(0, 12);
    if (first.length < 12 || first.toString('latin1', 4, 8) !== 'ftyp') return { isMp4: false, durationSec: null };

    const findBox = async (start: number, end: number, type: string): Promise<{ body: number; end: number } | null> => {
      let pos = start;
      while (pos + 8 <= end) {
        const h = await read(pos, 16);
        if (h.length < 8) return null;
        let boxSize = h.readUInt32BE(0);
        let header = 8;
        if (boxSize === 1) {
          boxSize = Number(h.readBigUInt64BE(8));
          header = 16;
        } else if (boxSize === 0) {
          boxSize = end - pos;
        }
        if (boxSize < header) return null;
        if (h.toString('latin1', 4, 8) === type) return { body: pos + header, end: pos + boxSize };
        pos += boxSize;
      }
      return null;
    };

    const moov = await findBox(0, size, 'moov');
    const mvhd = moov && (await findBox(moov.body, moov.end, 'mvhd'));
    if (!mvhd) return { isMp4: true, durationSec: null };
    const b = await read(mvhd.body, 32);
    const [timescale, duration] =
      b[0] === 1 ? [b.readUInt32BE(20), Number(b.readBigUInt64BE(24))] : [b.readUInt32BE(12), b.readUInt32BE(16)];
    return { isMp4: true, durationSec: timescale ? Math.round(duration / timescale) : null };
  } finally {
    await fh.close();
  }
}
