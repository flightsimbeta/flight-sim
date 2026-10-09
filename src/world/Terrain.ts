import * as THREE from 'three';

const WORLD_SIZE_M = 6000;   // 6km × 6km
const WORLD_SEG = 96;        // mesh çözünürlüğü
const GRID_N = 32;           // yükseklik örnekleme grid'i

/**
 * Gerçek yükseklik verisini Open-Meteo'dan çeker ve mesh oluşturur.
 * Dünya merkezi (centerLat, centerLon), yarıçap yaklaşık 0.025° (~2.7 km).
 */
export class Terrain {
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  private centerLat: number;
  private centerLon: number;
  private elevation: Float32Array | null = null;
  private halfSpanDeg: number;
  private cosLat: number;

  constructor(scene: THREE.Scene) {
    this.centerLat = 41.1053;  // Hezarfen, İstanbul
    this.centerLon = 28.5500;
    this.halfSpanDeg = 0.027;   // ~3 km
    this.cosLat = Math.cos(this.centerLat * Math.PI / 180);

    this.geometry = new THREE.PlaneGeometry(WORLD_SIZE_M, WORLD_SIZE_M, WORLD_SEG, WORLD_SEG);
    this.geometry.rotateX(-Math.PI / 2);

    const colors = new Float32Array(this.geometry.attributes.position.count * 3);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0,
        flatShading: false
      })
    );
    scene.add(this.mesh);

    // Başlangıçta prosedürel doldur (yükleme bitene kadar)
    this.fillProcedural();
  }

  getCenter(): { lat: number; lon: number } {
    return { lat: this.centerLat, lon: this.centerLon };
  }

  /** Belirtilen koordinattaki zemin yüksekliği (dünya koordinatları, metre) */
  heightAt(x: number, z: number): number {
    if (!this.elevation) return 0;

    const u = x / WORLD_SIZE_M + 0.5;
    const v = z / WORLD_SIZE_M + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return -50;

    const fu = u * (GRID_N - 1);
    const fv = v * (GRID_N - 1);
    const i0 = Math.floor(fu), j0 = Math.floor(fv);
    const i1 = Math.min(i0 + 1, GRID_N - 1);
    const j1 = Math.min(j0 + 1, GRID_N - 1);
    const tu = fu - i0, tv = fv - j0;

    const a = this.elevation[j0 * GRID_N + i0];
    const b = this.elevation[j0 * GRID_N + i1];
    const c = this.elevation[j1 * GRID_N + i0];
    const d = this.elevation[j1 * GRID_N + i1];

    return (a * (1 - tu) + b * tu) * (1 - tv) + (c * (1 - tu) + d * tu) * tv;
  }

  /** Belirtilen lat/lon için Open-Meteo'dan yükseklik çek ve mesh'i yeniden inşa et */
  async loadAt(lat: number, lon: number): Promise<void> {
    this.centerLat = lat;
    this.centerLon = lon;
    this.cosLat = Math.cos(lat * Math.PI / 180);

    const lats: number[] = [];
    const lons: number[] = [];
    for (let j = 0; j < GRID_N; j++) {
      for (let i = 0; i < GRID_N; i++) {
        const u = i / (GRID_N - 1);
        const v = j / (GRID_N - 1);
        lats.push(lat + (v - 0.5) * 2 * this.halfSpanDeg);
        lons.push(lon + (u - 0.5) * 2 * this.halfSpanDeg / this.cosLat);
      }
    }

    const elev = new Float32Array(GRID_N * GRID_N);
    const BATCH = 100;
    for (let s = 0; s < lats.length; s += BATCH) {
      const e = Math.min(s + BATCH, lats.length);
      const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.slice(s, e).join(',')}&longitude=${lons.slice(s, e).join(',')}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Elevation API hatası');
      const data = await r.json();
      for (let k = 0; k < data.elevation.length; k++) {
        elev[s + k] = data.elevation[k];
      }
    }
    this.elevation = elev;
    this.rebuildMesh();
  }

  private fillProcedural(): void {
    const p = this.geometry.attributes.position;
    const colors = this.geometry.attributes.color;
    const col = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // Düşük genlikli prosedürel
      const h = Math.sin(x * 0.0015) * Math.cos(z * 0.0018) * 15
              + Math.sin(x * 0.006) * Math.sin(z * 0.005) * 4;
      p.setY(i, h);
      this.colorForHeight(h, col);
      colors.setXYZ(i, col.r, col.g, col.b);
    }
    p.needsUpdate = true;
    colors.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  private rebuildMesh(): void {
    if (!this.elevation) return;

    const p = this.geometry.attributes.position;
    const colors = this.geometry.attributes.color;
    const col = new THREE.Color();

    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = this.heightAt(x, z);
      p.setY(i, h);
      this.colorForHeight(h, col);
      // Hafif gürültü
      const n = 0.94 + ((Math.sin(x * 0.37) * Math.cos(z * 0.41)) * 0.5 + 0.5) * 0.12;
      colors.setXYZ(i, col.r * n, col.g * n, col.b * n);
    }
    p.needsUpdate = true;
    colors.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  private colorForHeight(h: number, out: THREE.Color): void {
    // Rakım → renk (deniz altı, kum, çimen, kayalık, kar)
    if (h < -20)      out.setHex(0x0e2230);
    else if (h < 0)   out.setHex(0x1a3a52);
    else if (h < 5)   out.setHex(0xc8b878);
    else if (h < 40)  out.setHex(0x5a8f4a);
    else if (h < 120) out.setHex(0x3a6b38);
    else if (h < 220) out.setHex(0x6a6658);
    else              out.setHex(0xd0d4d8);
  }
}
