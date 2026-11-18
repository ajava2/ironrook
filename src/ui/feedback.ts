let ctx: AudioContext | undefined;

/** iOS solo permite crear/reanudar el AudioContext dentro de un gesto del usuario. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = undefined;
  }
}

export function beep(times = 3): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = i === times - 1 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, now + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.22 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.22);
    osc.stop(now + i * 0.22 + 0.18);
  }
}

export function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
