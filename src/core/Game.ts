import * as THREE from 'three';
import { Aircraft } from '../aircraft/Aircraft';
import { CESSNA_172 } from '../aircraft/specs';
import { InputManager } from '../input/Input';
import { HUD } from '../hud/HUD';
import { World } from '../world/World';
import { EngineAudio } from '../audio/Engine';
import { UI, LocationResult } from '../ui/UI';
import { MusicPlayer } from '../ui/MusicPlayer';
import type { ControlInput } from '../physics/FlightModel';
import { vAdd, vScale, vNorm, vSub } from '../math';

export class Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  world: World;
  aircraft: Aircraft;
  input: InputManager;
  hud: HUD;
  audio: EngineAudio;
  ui: UI;
  music: MusicPlayer;

  private last = performance.now();
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 120;
  private readonly MAX_FRAME = 0.1;

  private throttle = 0;
  private camTarget = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camInitialized = false;
  private sunDir = new THREE.Vector3(0.35, 0.8, 0.25).normalize();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.5, 30000);

    this.world = new World(this.scene);
    const spawn = this.world.airport.spawnPosition();
    this.aircraft = new Aircraft(
      CESSNA_172,
      new THREE.Vector3(spawn.x, spawn.y, spawn.z),
      spawn.heading
    );
    this.scene.add(this.aircraft.mesh);

    this.input = new InputManager();
    this.hud = new HUD();
    this.audio = new EngineAudio();
    this.ui = new UI();
    this.music = new MusicPlayer();

    this.wireInputs();
    this.wireUI();

    addEventListener('resize', () => this.onResize());
  }

  private wireInputs(): void {
    this.input.onToggleMusic = () => this.ui.toggleMusicPanel();
    this.input.onOpenSearch = () => this.ui.open();
    this.input.onToggleTarget = () => { /* v0.6 */ };
    this.input.onReset = () => this.reset();
  }

  private wireUI(): void {
    this.ui.onSearch = (q) => this.doSearch(q);
    this.ui.onTeleport = (loc) => this.teleport(loc);
    this.music.onUpdate = () => {
      this.ui.setMusicName(this.music.currentName);
      this.ui.setMusicPlayIcon(this.music.playing);
    };
  }

  start(): void {
    requestAnimationFrame(this.tick);
  }

  private async doSearch(q: string): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await r.json();
      const results: LocationResult[] = data.map((it: any) => ({
        name: (it.name || it.display_name.split(',')[0]).trim(),
        lat: +it.lat,
        lon: +it.lon,
        fullName: it.display_name
      }));
      this.ui.renderResults(results);
    } catch {
      this.ui.renderResults([]);
    }
  }

  private async teleport(loc: LocationResult): Promise<void> {
    this.ui.showLoading('Yükseklik verisi çekiliyor...');
    try {
      await this.world.loadAt(loc.lat, loc.lon);
    } catch (e) {
      console.warn('Yükleme hatası, prosedürel arazi kullanılıyor', e);
    }
    // Uçağı yeni havalimanına yerleştir
    const spawn = this.world.airport.spawnPosition();
    this.aircraft.state.position = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.aircraft.state.velocity = { x: 0, y: 0, z: 0 };
    this.aircraft.state.angularVel = { x: 0, y: 0, z: 0 };
    this.aircraft.onGround = true;
    this.throttle = 0;
    this.camInitialized = false;

    this.ui.close();
    this.audio.start();
  }

  private reset(): void {
    const spawn = this.world.airport.spawnPosition();
    this.aircraft.state.position = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.aircraft.state.velocity = { x: 0, y: 0, z: 0 };
    this.aircraft.state.angularVel = { x: 0, y: 0, z: 0 };
    this.aircraft.state.orientation = { x: 0, y: 0, z: 0, w: 1 };
    this.aircraft.onGround = true;
    this.throttle = 0;
    this.camInitialized = false;
  }

  private tick = (now: number): void => {
    requestAnimationFrame(this.tick);

    const frameTime = Math.min((now - this.last) / 1000, this.MAX_FRAME);
    this.last = now;

    // Gaz entegrasyonu (klavye / dokunmatik)
    const touchThr = this.input.touchThrottleValue;
    if (touchThr !== null) {
      this.throttle = touchThr;
    } else {
      const delta = this.input.throttleDelta;
      if (delta !== 0) {
        this.throttle = Math.max(0, Math.min(1, this.throttle + delta * 0.5 * frameTime));
      }
    }

    // Fizik (sabit adım)
    this.accumulator += frameTime;
    const baseInput = this.input.input;
    const control: ControlInput = { ...baseInput, throttle: this.throttle };

    while (this.accumulator >= this.FIXED_DT) {
      const gh = this.world.groundHeight(
        this.aircraft.state.position.x,
        this.aircraft.state.position.z
      );
      const ev = this.aircraft.update(this.FIXED_DT, control, gh);
      if (ev === 'crash') {
        this.audio.crash();
        this.reset();
        break;
      }
      this.accumulator -= this.FIXED_DT;
    }

    this.aircraft.syncMesh();

    // Kamera
    this.updateCamera(frameTime);

    // Ses
    this.audio.update(
      this.aircraft.debug.airspeed,
      this.throttle,
      control.afterburner,
      this.aircraft.debug.airspeed > 1 || this.throttle > 0.05
    );

    // Dünya
    this.world.update(this.camera.position, this.sunDir);

    // HUD
    this.hud.draw(this.aircraft, this.camera, this.throttle);

    this.renderer.render(this.scene, this.camera);
  };

  private updateCamera(dt: number): void {
    const mode = this.input.camMode;
    const p = this.aircraft.state.position;
    const o = this.aircraft.state.orientation;

    let offset: THREE.Vector3;
    let lookOffset: THREE.Vector3;

    if (mode === 0) {
      offset = new THREE.Vector3(0, 6, 22);
      lookOffset = new THREE.Vector3(0, 1, -30);
    } else if (mode === 1) {
      offset = new THREE.Vector3(0, 0.9, -0.5);
      lookOffset = new THREE.Vector3(0, 0.9, -50);
    } else {
      offset = new THREE.Vector3(0, 30, 80);
      lookOffset = new THREE.Vector3(0, 3, -20);
    }

    const q = new THREE.Quaternion(o.x, o.y, o.z, o.w);
    const targetPos = offset.clone().applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
    const targetLook = lookOffset.clone().applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));

    if (!this.camInitialized) {
      this.camera.position.copy(targetPos);
      this.camLook.copy(targetLook);
      this.camInitialized = true;
    } else {
      const t = 1 - Math.pow(0.001, dt);
      this.camera.position.lerp(targetPos, t);
      this.camLook.lerp(targetLook, t);
    }

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.camLook);
  }

  private onResize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
