import type { ControlInput } from '../physics/FlightModel';

export class InputManager {
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private touchThrottle: number | null = null;
  private touchAB = false;
  private afterburner = false;
  public gearDown = true;
  public camMode = 0;

  // Callback'ler (Game'e bağlanır)
  onToggleMusic?: () => void;
  onOpenSearch?: () => void;
  onToggleTarget?: () => void;
  onReset?: () => void;

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
  }

  private setupKeyboard(): void {
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (e.repeat) return;

      switch (e.code) {
        case 'KeyF': this.afterburner = !this.afterburner; break;
        case 'KeyG': this.gearDown = !this.gearDown; break;
        case 'KeyC': this.camMode = (this.camMode + 1) % 3; break;
        case 'KeyR': this.onReset?.(); break;
        case 'KeyP': this.onOpenSearch?.(); break;
        case 'KeyT': this.onToggleTarget?.(); break;
        case 'KeyM': this.onToggleMusic?.(); break;
      }
    }, { passive: false });

    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.afterburner = false;
    });
  }

  private setupTouch(): void {
    const touch = document.getElementById('touch');
    const joyBase = document.getElementById('joyBase');
    const joyKnob = document.getElementById('joyKnob');
    const thrBase = document.getElementById('thrBase');
    const thrKnob = document.getElementById('thrKnob');

    if (!touch || !joyBase || !joyKnob || !thrBase || !thrKnob) return;

    // Dokunmatik cihaz tespiti
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      touch.classList.add('on');
    }

    let joyId: number | null = null;
    let thrId: number | null = null;

    const updateJoy = (t: Touch) => {
      const r = joyBase.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (t.clientX - cx) / (r.width / 2);
      let dy = (t.clientY - cy) / (r.height / 2);
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      this.joy.x = dx;
      this.joy.y = dy;
      (joyKnob as HTMLElement).style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };

    const updateThr = (t: Touch) => {
      const r = thrBase.getBoundingClientRect();
      const y = t.clientY - r.top;
      const v = Math.max(0, Math.min(1, 1 - (y - 20) / 110));
      this.touchThrottle = v;
      (thrKnob as HTMLElement).style.top = `${(1 - v) * 110 + 20}px`;
    };

    const resetJoy = () => {
      this.joy.x = 0;
      this.joy.y = 0;
      (joyKnob as HTMLElement).style.transform = 'translate(0, 0)';
    };

    joyBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      updateJoy(t);
    }, { passive: false });

    joyBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyId) updateJoy(t);
      }
    }, { passive: false });

    joyBase.addEventListener('touchend', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyId) { joyId = null; resetJoy(); }
      }
    }, { passive: false });

    thrBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      thrId = t.identifier;
      updateThr(t);
    }, { passive: false });

    thrBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === thrId) updateThr(t);
      }
    }, { passive: false });

    thrBase.addEventListener('touchend', () => { thrId = null; }, { passive: false });

    // Araç çubuğu butonları
    document.getElementById('btnMus')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onToggleMusic?.();
    }, { passive: false });

    document.getElementById('btnNav')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onOpenSearch?.();
    }, { passive: false });

    document.getElementById('btnTgt')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onToggleTarget?.();
    }, { passive: false });

    document.getElementById('btnCam')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.camMode = (this.camMode + 1) % 3;
    }, { passive: false });

    const btnAB = document.getElementById('btnAB');
    btnAB?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchAB = true;
    }, { passive: false });
    btnAB?.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.touchAB = false;
    }, { passive: false });
    btnAB?.addEventListener('touchcancel', () => { this.touchAB = false; });
  }

  get input(): ControlInput {
    let pitch = 0, roll = 0, yaw = 0;
    let throttleDelta = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))   pitch += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) pitch -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  roll += 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) roll -= 1;
    if (this.keys.has('KeyQ')) yaw += 1;
    if (this.keys.has('KeyE')) yaw -= 1;
    if (this.keys.has('Space')) throttleDelta += 1;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) throttleDelta -= 1;

    // Joystick override
    if (this.joy.x !== 0 || this.joy.y !== 0) {
      pitch = -this.joy.y;
      roll = -this.joy.x;
    }

    return {
      pitch, roll, yaw,
      throttle: 0,       // Game tarafından entegre edilir
      flaps: 0,
      gearDown: this.gearDown,
      afterburner: this.afterburner || this.touchAB,
      brake: this.keys.has('KeyB') ? 1 : 0
    };
  }

  get throttleDelta(): number {
    let t = 0;
    if (this.keys.has('Space')) t += 1;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) t -= 1;
    return t;
  }

  get touchThrottleValue(): number | null {
    return this.touchThrottle;
  }
}
