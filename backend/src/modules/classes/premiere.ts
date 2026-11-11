/**
 * Premiere: a recorded video played "as live". Everyone watches the same moment: the position is
 * simply (now - startAt), so late joiners come in mid-way, exactly like a live class.
 */

/** A premiere lasts as long as its video, rounded up to the whole minute. */
export function premiereEnd(startAt: Date, durationSec: number): Date {
  const minutes = Math.max(1, Math.ceil(durationSec / 60));
  return new Date(startAt.getTime() + minutes * 60_000);
}

/** Seconds into the video right now (0 before the start). */
export function premierePosition(startAt: Date, now = new Date()): number {
  return Math.max(0, (now.getTime() - startAt.getTime()) / 1000);
}
