import { premiereEnd, premierePosition } from './premiere.js';

describe('premiereEnd', () => {
  const start = new Date('2026-11-12T10:00:00.000Z');

  it('lasts as long as the video, rounded up to the minute', () => {
    expect(premiereEnd(start, 3600).toISOString()).toBe('2026-11-12T11:00:00.000Z');
    expect(premiereEnd(start, 3601).toISOString()).toBe('2026-11-12T11:01:00.000Z');
    expect(premiereEnd(start, 90).toISOString()).toBe('2026-11-12T10:02:00.000Z');
  });

  it('is at least one minute long', () => {
    expect(premiereEnd(start, 0).toISOString()).toBe('2026-11-12T10:01:00.000Z');
  });
});

describe('premierePosition', () => {
  const start = new Date('2026-11-12T10:00:00.000Z');

  it('is the time since the start', () => {
    expect(premierePosition(start, new Date('2026-11-12T10:05:30.000Z'))).toBe(330);
  });

  it('is 0 before the start', () => {
    expect(premierePosition(start, new Date('2026-11-12T09:50:00.000Z'))).toBe(0);
  });
});
