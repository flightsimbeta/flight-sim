import * as THREE from 'three';
import type { Terrain } from './Terrain';

const RUNWAY_LENGTH_M = 600;
const RUNWAY_WIDTH_M  = 30;
const FLATTEN_RADIUS  = 400;

export class Airport {
  group: THREE.Group;
  centerX = 0;
  centerZ = 0;
  groundY = 0;
  private terrain: Terrain;

  constructor(scene: THREE.Scene, terrain: Terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  /** Terrain merkezinde bir havalimanı inşa et ve etrafını düzleştir */
  rebuild(): void {
    // Havalimanı merkezi: terrain (0,0)
    this.centerX = 0;
    this.centerZ = 0;
    this.groundY = this.terrain.heightAt(0, 0);

    // Mevcut mesh'i temizle
    while (this.group.children.length) {
      const c = this.group.children.pop()!;
      this.group.remove(c);
    }

    const y = this.groundY;

    // Asfalt
    const asphalt = new THREE.Mesh(
      new THREE.BoxGeometry(RUNWAY_WIDTH_M, 0.8, RUNWAY_LENGTH_M),
      new THREE.MeshStandardMaterial({ color: 0x1e2128, roughness: 0.95 })
    );
    asphalt.position.set(this.centerX, y + 0.4, this.centerZ);
    this.group.add(asphalt);

    // Taksi yolu (apron)
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(60, 0.6, 80),
      new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.92 })
    );
    apron.position.set(this.centerX + 55, y + 0.3, this.centerZ + 120);
    this.group.add(apron);

    // Orta şerit
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0, roughness: 0.6, emissive: 0x080808
    });
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue;
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 14), stripeMat);
      s.position.set(this.centerX, y + 0.85, this.centerZ + i * 22);
      this.group.add(s);
    }

    // Pist eşiği
    for (const dir of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.8), stripeMat);
        s.position.set(
          this.centerX - 10 + k * 4.0,
          y + 0.86,
          this.centerZ + dir * (RUNWAY_LENGTH_M / 2 - 8)
        );
        this.group.add(s);
      }
    }

    // Kenar ışıkları
    const lightGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x66ffcc, emissive: 0x33ffbb, emissiveIntensity: 2.0
    });
    for (let i = -14; i <= 14; i++) {
      for (const s of [-1, 1]) {
        const l = new THREE.Mesh(lightGeo, lightMat.clone());
        l.position.set(
          this.centerX + s * (RUNWAY_WIDTH_M / 2 + 2),
          y + 1.1,
          this.centerZ + i * 20
        );
        this.group.add(l);
      }
    }

    // Yaklaşma ışıkları
    const appMat = new THREE.MeshStandardMaterial({
      color: 0xffaa44, emissive: 0xff8822, emissiveIntensity: 3.0
    });
    for (const dir of [-1, 1]) {
      for (let i = 1; i <= 5; i++) {
        const l = new THREE.Mesh(lightGeo, appMat.clone());
        l.position.set(
          this.centerX,
          y + 1.4,
          this.centerZ + dir * (RUNWAY_LENGTH_M / 2 + 15 + i * 15)
        );
        this.group.add(l);
      }
    }
  }

  /** Araziyi havalimanı çevresinde düzleştirilmiş yükseklik döndürür */
  flattenedHeight(x: number, z: number, baseHeight: number): number {
    const dx = x - this.centerX;
    const dz = z - this.centerZ;
    const d = Math.hypot(dx, dz);
    if (d > FLATTEN_RADIUS) return baseHeight;
    const inner = FLATTEN_RADIUS * 0.35;
    if (d < inner) return this.groundY;
    const t = 1 - (d - inner) / (FLATTEN_RADIUS - inner);
    const s = t * t * (3 - 2 * t);  // smoothstep
    return baseHeight * (1 - s) + this.groundY * s;
  }

  /** Uçağın başlangıç konumu (pist başı, tekerlek yüksekliği) */
  spawnPosition(): { x: number; y: number; z: number; heading: number } {
    return {
      x: this.centerX,
      y: this.groundY + 1.4,
      z: this.centerZ + RUNWAY_LENGTH_M / 2 - 40,
      heading: 0  // kuzeye bak (Three.js'de -Z)
    };
  }
}
