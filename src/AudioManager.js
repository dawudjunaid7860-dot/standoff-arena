// Thin Web Audio wrapper: decodes each clip once, plays via a fresh
// BufferSource per call so overlapping shots (player + enemy) don't cut
// each other off the way reusing a single <audio> element would.
export class AudioManager {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.context = Ctx ? new Ctx() : null;
    this.buffers = new Map();
    this._unlocked = false;
    if (this.context) {
      const unlock = () => {
        if (this.context.state === 'suspended') this.context.resume();
        this._unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('touchstart', unlock);
    }
  }

  async load(name, url) {
    if (!this.context) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.buffers.set(name, audioBuffer);
  }

  play(name, { volume = 1, rate = 1 } = {}) {
    if (!this.context) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = this.context.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(this.context.destination);
    source.start(0);
  }

  // No explosion clip was provided, so this synthesizes a short low-end
  // thump (a downward-sweeping oscillator plus a burst of filtered noise)
  // instead of leaving hazard explosions silent.
  playExplosion(volume = 1) {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
  }
}
