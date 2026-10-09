import * as THREE from 'three';
import { Aircraft, groundSpeed, headingDeg } from '../aircraft/Aircraft';

export class HUD {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private dpr: number;

  constructor() {
    this.canvas = document.getElementById('hud') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.dpr = Math.min(devicePixelRatio, 2);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = innerWidth * this.dpr;
    this.canvas.height = innerHeight * this.dpr;
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(ac: Aircraft, camera: THREE.PerspectiveCamera, throttle: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    const d = ac.debug;
    const pos = ac.state.position;
    const gs = groundSpeed(ac);
    const hdg = headingDeg(ac);

    // Sol üst bilgi paneli
    this.panel(20, 20, 180, 130);
    this.label('HIZ (IAS)', 32, 40);
    this.value(`${(d.airspeed * 1.94384).toFixed(0)}`, 'kt', 32, 62);
    this.label('İRTİFA', 32, 84);
    this.value(`${(pos.y * 3.28084).toFixed(0)}`, 'ft', 32, 106);
    this.label('G-KUVVET', 32, 128);
    this.value(`${d.gForce.toFixed(1)}`, 'g', 32, 148, d.gForce > 4 ? '#ff7070' : undefined);

    // Sağ üst
    this.panel(innerWidth - 200, 20, 180, 130);
    const rx = innerWidth - 188;
    this.label('GAZ', rx, 40);
    this.value(`${(throttle * 100).toFixed(0)}`, '%', rx, 62);
    this.label('YER HIZI', rx, 84);
    this.value(`${(gs * 1.94384).toFixed(0)}`, 'kt', rx, 106);
    this.label('YÖN', rx, 128);
    this.value(`${hdg.toFixed(0)}`, '°', rx, 148);

    // Yapay ufuk (sol alt)
    this.drawAttitude(110, innerHeight - 110, 90, ac);

    // Pusula (üst orta)
    this.drawCompass(innerWidth / 2, 40, Math.min(500, innerWidth * 0.6), hdg);

    // Stall uyarısı
    if (d.stalled) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,60,60,0.9)';
      ctx.font = 'bold 28px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,0,0,0.8)';
      ctx.shadowBlur = 20;
      ctx.fillText('STALL', innerWidth / 2, innerHeight * 0.42);
      ctx.restore();
    }

    // Mobil uyarı
    if (innerWidth < 640) {
      ctx.save();
      ctx.fillStyle = '#4aa8c8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('dokunmatik aktif', 12, innerHeight - 12);
      ctx.restore();
    }
  }

  private panel(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(6,20,32,0.5)';
    ctx.strokeStyle = 'rgba(80,200,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private label(text: string, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#4aa8c8';
    ctx.font = '9px ui-monospace, monospace';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private value(num: string, unit: string, x: number, y: number, color = '#a8f0ff'): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.shadowColor = 'rgba(80,200,255,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText(num, x, y);
    const w = ctx.measureText(num).width;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4aa8c8';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(' ' + unit, x + w, y);
    ctx.restore();
  }

  private drawAttitude(cx: number, cy: number, r: number, ac: Aircraft): void {
    const ctx = this.ctx;

    // Uçak yönünden pitch ve roll çıkar
    const q = ac.state.orientation;
    // Forward vector'ı quaternion ile döndür
    const ix = q.w * 0 + q.y * (-1) - q.z * 0;
    const iy = q.w * 0 + q.z * 0 - q.x * (-1);
    const iz = q.w * (-1) + q.x * 0 - q.y * 0;
    const iw = -q.x * 0 - q.y * 0 - q.z * (-1);
    const fx = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
    const fy = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
    const fz = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;

    const pitchDeg = Math.asin(Math.max(-1, Math.min(1, fy))) * 180 / Math.PI;
    // Roll: sağ kanadın y ekseni
    const ux = q.w * 1 + q.y * 0 - q.z * 0;
    const uy = q.w * 0 + q.z * 1 - q.x * 0;
    const uz = q.w * 0 + q.x * 0 - q.y * 1;
    const uw = -q.x * 1 - q.y * 0 - q.z * 0;
    const rx = ux * q.w + uw * -q.x + uy * -q.z - uz * -q.y;
    const ry = uy * q.w + uw * -q.y + uz * -q.x - ux * -q.z;
    const rollRad = Math.atan2(-ry, fy);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);

    const pxPerDeg = r / 30;
    ctx.translate(0, pitchDeg * pxPerDeg);

    ctx.fillStyle = 'rgba(60,140,220,0.4)';
    ctx.fillRect(-r * 2, -r * 4, r * 4, r * 4);
    ctx.fillStyle = 'rgba(140,90,40,0.4)';
    ctx.fillRect(-r * 2, 0, r * 4, r * 4);
    ctx.strokeStyle = '#7fe7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 1.4, 0);
    ctx.lineTo(r * 1.4, 0);
    ctx.stroke();

    // Pitch çizgileri
    ctx.strokeStyle = 'rgba(180,240,255,0.75)';
    ctx.lineWidth = 1;
    for (let d = -20; d <= 20; d += 5) {
      if (d === 0) continue;
      const y = -d * pxPerDeg;
      const len = (d % 10 === 0) ? r * 0.3 : r * 0.15;
      ctx.beginPath();
      ctx.moveTo(-len, y);
      ctx.lineTo(len, y);
      ctx.stroke();
    }

    ctx.restore();

    // Çerçeve
    ctx.strokeStyle = 'rgba(120,220,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Uçak sembolü
    ctx.strokeStyle = '#a8f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 30, cy);
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
  }

  private drawCompass(cx: number, cy: number, w: number, heading: number): void {
    const ctx = this.ctx;
    const half = 60;
    const pxPerDeg = w / (half * 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2, cy - 18, w, 38);
    ctx.clip();

    ctx.strokeStyle = 'rgba(120,220,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + 12);
    ctx.lineTo(cx + w / 2, cy + 12);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const CARD: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

    for (let off = -half; off <= half; off += 5) {
      const raw = heading + off;
      const h = ((raw % 360) + 360) % 360;
      const x = cx + off * pxPerDeg;
      const isCard = Math.abs(h % 90) < 0.5;
      const isMajor = Math.abs(h % 30) < 0.5;
      const isMid = Math.abs(h % 10) < 0.5;
      let len = 5;
      if (isCard) len = 14;
      else if (isMajor) len = 10;
      else if (isMid) len = 8;

      ctx.strokeStyle = isCard ? '#a8f0ff' : 'rgba(120,220,255,0.65)';
      ctx.lineWidth = isCard ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, cy + 12 - len);
      ctx.lineTo(x, cy + 12);
      ctx.stroke();

      if (isCard) {
        ctx.fillStyle = '#a8f0ff';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.fillText(CARD[Math.round(h) % 360] ?? '', x, cy - 4);
      } else if (isMajor) {
        ctx.fillStyle = 'rgba(180,240,255,0.85)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(String(Math.round(h)).padStart(2, '0'), x, cy - 4);
      }
    }
    ctx.restore();

    // İşaretçi
    ctx.fillStyle = '#7fe7ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 14);
    ctx.lineTo(cx - 5, cy + 21);
    ctx.lineTo(cx + 5, cy + 21);
    ctx.closePath();
    ctx.fill();

    // Sayı
    ctx.fillStyle = '#a8f0ff';
    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, cy + 32);
  }
}
