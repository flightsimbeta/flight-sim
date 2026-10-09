/**
 * Katmanlı jet motor sesi.
 *
 * Katmanlar:
 *   1. Sub sine (30-90 Hz)          → temel motor tokmağı
 *   2. Sawtooth × 2 (detune)         → kalın, dokulu motor gövdesi
 *   3. Türbin whine (300-3500 Hz)    → jet motorunun çığlığı
 *   4. Bandpass gürültü              → hava emme / rüzgar
 *
 * Art yakıcı:
 *   - 40 Hz sub rumble
 *   - Rezonanslı lowpass gürültü     → roar
 *   - Highpass seyrek impuls         → crackle
 */
export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engBus!: GainNode;
  private abBus!: GainNode;
  private sub!: OscillatorNode;
  private saw1!: OscillatorNode;
  private saw2!: OscillatorNode;
  private sawFilt!: BiquadFilterNode;
  private whine!: OscillatorNode;
  private whineGain!: GainNode;
  private noiseFilt!: BiquadFilterNode;
  private noiseGain!: GainNode;
  private abSub!: OscillatorNode;
  private abFilt!: BiquadFilterNode;
  private crGain!: GainNode;
  private started = false;
  private muted = false;

  start(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    // Master + kompresör
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // Motor bus
    this.engBus = ctx.createGain();
    this.engBus.gain.value = 0;
    this.engBus.connect(this.master);

    // Sub
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    this.sub.frequency.value = 30;
    const subG = ctx.createGain();
    subG.gain.value = 0.5;
    this.sub.connect(subG);
    subG.connect(this.engBus);
    this.sub.start();

    // Saw × 2
    this.saw1 = ctx.createOscillator();
    this.saw1.type = 'sawtooth';
    this.saw1.frequency.value = 60;
    this.saw2 = ctx.createOscillator();
    this.saw2.type = 'sawtooth';
    this.saw2.frequency.value = 60;
    this.saw2.detune.value = 14;

    const sawMix = ctx.createGain();
    sawMix.gain.value = 0.32;
    this.sawFilt = ctx.createBiquadFilter();
    this.sawFilt.type = 'lowpass';
    this.sawFilt.frequency.value = 500;
    this.sawFilt.Q.value = 3.5;

    this.saw1.connect(sawMix);
    this.saw2.connect(sawMix);
    sawMix.connect(this.sawFilt);
    this.sawFilt.connect(this.engBus);
    this.saw1.start();
    this.saw2.start();

    // Türbin whine
    this.whine = ctx.createOscillator();
    this.whine.type = 'sine';
    this.whine.frequency.value = 400;
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain);
    this.whineGain.connect(this.engBus);
    this.whine.start();

    // Hava gürültüsü
    const nbuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = nbuf;
    noise.loop = true;
    this.noiseFilt = ctx.createBiquadFilter();
    this.noiseFilt.type = 'bandpass';
    this.noiseFilt.frequency.value = 400;
    this.noiseFilt.Q.value = 0.7;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    noise.connect(this.noiseFilt);
    this.noiseFilt.connect(this.noiseGain);
    this.noiseGain.connect(this.engBus);
    noise.start();

    // Art yakıcı bus
    this.abBus = ctx.createGain();
    this.abBus.gain.value = 0;
    this.abBus.connect(this.master);

    // AB sub rumble
    this.abSub = ctx.createOscillator();
    this.abSub.type = 'sine';
    this.abSub.frequency.value = 42;
    const abSubG = ctx.createGain();
    abSubG.gain.value = 0.9;
    this.abSub.connect(abSubG);
    abSubG.connect(this.abBus);
    this.abSub.start();

    // AB roar
    const abBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const abd = abBuf.getChannelData(0);
    for (let i = 0; i < abd.length; i++) abd[i] = Math.random() * 2 - 1;
    const abNoise = ctx.createBufferSource();
    abNoise.buffer = abBuf;
    abNoise.loop = true;
    this.abFilt = ctx.createBiquadFilter();
    this.abFilt.type = 'lowpass';
    this.abFilt.frequency.value = 800;
    this.abFilt.Q.value = 2.2;
    const abNg = ctx.createGain();
    abNg.gain.value = 0.55;
    abNoise.connect(this.abFilt);
    this.abFilt.connect(abNg);
    abNg.connect(this.abBus);
    abNoise.start();

    // AB crackle
    const crBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const crd = crBuf.getChannelData(0);
    for (let i = 0; i < crd.length; i++) {
      crd[i] = Math.random() > 0.998 ? (Math.random() * 2 - 1) : 0;
    }
    const crSrc = ctx.createBufferSource();
    crSrc.buffer = crBuf;
    crSrc.loop = true;
    const crFilt = ctx.createBiquadFilter();
    crFilt.type = 'highpass';
    crFilt.frequency.value = 1800;
    this.crGain = ctx.createGain();
    this.crGain.gain.value = 0.12;
    crSrc.connect(crFilt);
    crFilt.connect(this.crGain);
    this.crGain.connect(this.abBus);
    crSrc.start();

    this.master.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 1.0);
    this.started = true;
  }

  setMuted(m: boolean): void {
    if (!this.ctx) return;
    this.muted = m;
    this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.1);
  }

  update(airspeed: number, throttle: number, afterburner: boolean, engineOn: boolean): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const rpm = 45 + throttle * 110;
    const speedF = Math.min(60, airspeed * 0.14);

    this.sub.frequency.setTargetAtTime(engineOn ? rpm * 0.5 : 15, t, 0.08);
    this.saw1.frequency.setTargetAtTime(engineOn ? rpm + speedF : 25, t, 0.08);
    this.saw2.frequency.setTargetAtTime(engineOn ? rpm + speedF : 25, t, 0.08);

    const sawF = 200 + throttle * 900 + (afterburner ? 700 : 0);
    this.sawFilt.frequency.setTargetAtTime(sawF, t, 0.12);

    const whineF = 320 + throttle * 2400 + airspeed * 1.4 + (afterburner ? 900 : 0);
    this.whine.frequency.setTargetAtTime(engineOn ? whineF : 100, t, 0.12);
    const whineG = engineOn ? (0.015 + throttle * 0.045 + (afterburner ? 0.05 : 0)) : 0;
    this.whineGain.gain.setTargetAtTime(whineG, t, 0.18);

    const nf = 300 + airspeed * 2.4 + (afterburner ? 1100 : 0);
    this.noiseFilt.frequency.setTargetAtTime(nf, t, 0.18);
    const ng = engineOn ? (0.015 + throttle * 0.055 + airspeed / 4500 + (afterburner ? 0.03 : 0)) : 0;
    this.noiseGain.gain.setTargetAtTime(ng, t, 0.18);

    const eg = engineOn ? (0.5 + throttle * 0.3 + (afterburner ? 0.1 : 0)) : 0.08;
    this.engBus.gain.setTargetAtTime(eg, t, 0.12);

    this.abBus.gain.setTargetAtTime(afterburner ? 0.5 : 0, t, 0.2);
    if (afterburner) {
      this.abSub.frequency.setTargetAtTime(38 + throttle * 10 + Math.random() * 2.5, t, 0.12);
      this.abFilt.frequency.setTargetAtTime(600 + Math.random() * 500, t, 0.1);
      this.crGain.gain.setTargetAtTime(0.08 + Math.random() * 0.08, t, 0.08);
    }
  }

  blip(freq: number, dur: number, vol = 0.25): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  crash(): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 1.0);
    const g = ctx.createGain();
    g.gain.value = 0.75;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
  }
}
