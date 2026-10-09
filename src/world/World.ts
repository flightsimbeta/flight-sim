import * as THREE from 'three';
import { Sky } from './Sky';
import { Terrain } from './Terrain';
import { Airport } from './Airport';

export class World {
  scene: THREE.Scene;
  sky: Sky;
  terrain: Terrain;
  airport: Airport;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0x9ec4e0, 800, 5500);

    this.sky = new Sky(scene);
    this.terrain = new Terrain(scene);
    this.airport = new Airport(scene, this.terrain);

    // Işıklar
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2a3a1e, 1.0);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(amb);

    this.airport.rebuild();
  }

  /** Araziyi yeniden yükle (lat/lon) */
  async loadAt(lat: number, lon: number): Promise<void> {
    await this.terrain.loadAt(lat, lon);
    this.airport.rebuild();
  }

  /** Belirtilen koordinatta gerçek zemin yüksekliği (havalimanı düzleştirmesi dahil) */
  groundHeight(x: number, z: number): number {
    const base = this.terrain.heightAt(x, z);
    return this.airport.flattenedHeight(x, z, base);
  }

  update(cameraPos: THREE.Vector3, sunDir: THREE.Vector3): void {
    this.sky.update(cameraPos);
    this.sky.setSunDirection(sunDir);
  }
}
