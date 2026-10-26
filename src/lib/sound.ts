/**
 * Board sounds, synthesized with Web Audio (no sound files to license).
 * A soft wooden tap for moves, a lower double tap for captures, a quiet high note for check.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * A soft wooden tap: two short sine partials with a quick pitch drop, through a low-pass filter.
 * No noise, so it never sounds harsh.
 */
function tap(a: AudioContext, at: number, pitch: number, gain: number) {
  const out = a.createBiquadFilter();
  out.type = 'lowpass';
  out.frequency.value = 2200;
  out.connect(a.destination);
  for (const [mult, g, dur] of [
    [1, gain, 0.07],
    [2.6, gain * 0.25, 0.03],
  ]) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch * mult, at);
    o.frequency.exponentialRampToValueAtTime(pitch * mult * 0.75, at + dur);
    const env = a.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(g, at + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(env).connect(out);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
}

function tone(a: AudioContext, at: number, freq: number, dur: number, gain: number) {
  const o = a.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export type MoveSound = 'move' | 'capture' | 'check';

export function playMove(kind: MoveSound) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  if (kind === 'capture') {
    tap(a, t, 420, 0.35);
    tap(a, t + 0.05, 360, 0.25);
  } else {
    tap(a, t, 520, 0.3);
  }
  if (kind === 'check') tone(a, t + 0.06, 784, 0.16, 0.06);
}

/** Feedback in drills: a rising pair for solved, a low note for a miss. */
export function playResult(ok: boolean) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  if (ok) {
    tone(a, t, 660, 0.14, 0.07);
    tone(a, t + 0.1, 880, 0.2, 0.07);
  } else {
    tone(a, t, 262, 0.22, 0.06);
  }
}
