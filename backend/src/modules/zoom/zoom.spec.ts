import { createHmac } from 'node:crypto';
import { parseRange } from '../storage/files.controller.js';
import { pickMp4 } from './recording-import.service.js';
import { encodeMeetingUuid, ZoomApiService, zoomMeetingId } from './zoom-api.service.js';

describe('zoomMeetingId', () => {
  it('reads the meeting number from join links', () => {
    expect(zoomMeetingId('https://us05web.zoom.us/j/81234567890?pwd=abc')).toBe('81234567890');
    expect(zoomMeetingId('https://zoom.us/w/912345678')).toBe('912345678');
    expect(zoomMeetingId('https://app.zoom.us/wc/join/81234567890')).toBe('81234567890');
  });

  it('ignores other links', () => {
    expect(zoomMeetingId('https://meet.google.com/abc-defg-hij')).toBeNull();
    expect(zoomMeetingId('https://zoom.us.evil.com/j/81234567890')).toBeNull();
    expect(zoomMeetingId('https://zoom.us/my/drsingh')).toBeNull();
    expect(zoomMeetingId(null)).toBeNull();
    expect(zoomMeetingId('not a url')).toBeNull();
  });
});

describe('encodeMeetingUuid', () => {
  it('encodes once normally, twice for "/" uuids (Zoom rule)', () => {
    expect(encodeMeetingUuid('aBc+d==')).toBe('aBc%2Bd%3D%3D');
    expect(encodeMeetingUuid('/ab//c')).toBe('%252Fab%252F%252Fc');
  });
});

describe('pickMp4', () => {
  it('prefers screen + speaker, skips audio and unfinished files', () => {
    const f = pickMp4([
      { file_type: 'M4A', download_url: 'a' },
      { file_type: 'MP4', recording_type: 'gallery_view', download_url: 'g' },
      { file_type: 'MP4', recording_type: 'shared_screen_with_speaker_view', download_url: 's', status: 'processing' },
      { file_type: 'MP4', recording_type: 'speaker_view', download_url: 'v' },
    ]);
    expect(f?.download_url).toBe('v');
    expect(pickMp4([{ file_type: 'M4A', download_url: 'a' }])).toBeUndefined();
    expect(pickMp4(undefined)).toBeUndefined();
  });
});

describe('parseRange', () => {
  it('handles the ranges players send', () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=100-', 100)).toBe('invalid');
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull();
  });
});

describe('ZoomApiService.checkWebhook', () => {
  const config = {
    get: (k: string) =>
      ({ ZOOM_WEBHOOK_SECRET: 'whsec', ZOOM_API_URL: 'https://api.zoom.us/v2', ZOOM_OAUTH_URL: 'https://zoom.us/oauth/token', ZOOM_TRASH_AFTER_IMPORT: false })[k],
  };
  const zoom = new ZoomApiService(config as never);
  const body = Buffer.from('{"event":"recording.completed"}');
  const sign = (ts: string) => 'v0=' + createHmac('sha256', 'whsec').update(`v0:${ts}:${body.toString()}`).digest('hex');

  it('accepts a fresh, correctly signed request', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(zoom.checkWebhook(body, ts, sign(ts))).toBe(true);
  });

  it('rejects a wrong signature or an old timestamp', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(zoom.checkWebhook(body, ts, sign(String(Number(ts) - 1)))).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(zoom.checkWebhook(body, old, sign(old))).toBe(false);
    expect(zoom.checkWebhook(body, undefined, undefined)).toBe(false);
  });

  it('answers the URL validation challenge', () => {
    expect(zoom.urlValidation('tok')).toEqual({
      plainToken: 'tok',
      encryptedToken: createHmac('sha256', 'whsec').update('tok').digest('hex'),
    });
  });
});
