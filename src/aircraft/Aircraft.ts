import * as THREE from 'three';
import {
  stepFlight, AircraftSpec, AircraftState, ControlInput, AeroDebug
} from '../physics/FlightModel';
import { airDensity } from '../physics/Atmosphere';
import { v3, qFromAxisAngle, vNorm, vScale, vSub, vLen } from '../math';
import { buildAircraftMesh } from './Mesh';

export type AircraftEvent = 'crash' | 'landed' | 'takeoff';

export class Aircraft {
  state: AircraftState;
  spec: AircraftSpec;
  mesh: THREE.Group;
  debug: AeroDebug = {
    alpha: 0, beta: 0, airspeed: 0, CL: 0, CD: 0,
    stalled: false, gForce: 1, mach: 0
  };
  onGround = true;
  private wheelSpin = 0;

  constructor(spec: AircraftSpec, spawn: THREE.Vector3, headingRad: number) {
    this.spec = spec;
    const q = qFromAxisAngle({ x: 0, y: 1, z: 0 }, headingRad);
    this.state = {
      position: v3(spawn.x, spawn.y, spawn.z),
      velocity: v3(0, 0, 0),
      orientation: q,
      angularVel: v3(0, 0, 0)
    };
    this.mesh = buildAircraftMesh();
  }

  update(dt: number, input: ControlInput, groundHeight: number): AircraftEvent | null {
    const rho = airDensity(this.state.position.y);

    // Yerdeyken kontrol otoritesini kıs
    const local: ControlInput = { ...input };
    if (this.onGround) {
      local.roll *= 0.1;
      local.pitch *= 0.5;
    }

    const result = stepFlight(this.state, local, this.spec, dt, rho);
    this.state = result.state;
    this.debug = result.debug;

    // Zemin teması
    const gh = groundHeight;
    const clearance = 1.4;   // tekerlek yüksekliği
    if (this.state.position.y <= gh + clearance) {
      const wasAirborne = !this.onGround;
      const vy = this.state.velocity.y;

      // İniş OK mi? Dikey hız -6 m/s'den küçük (sert) veya stall → kaza
      const tooHard   = vy < -6.0;
      const tooFast   = this.debug.airspeed > 100;
      const isStalled = this.debug.stalled;

      if (tooHard && this.debug.airspeed > 40) return 'crash';
      if (isStalled && Math.abs(vy) > 3) return 'crash';

      this.state.position.y = gh + clearance;
      this.state.velocity.y = Math.max(0, this.state.velocity.y);
      this.onGround = true;

      // Kalkış kontrolü: yeterli hız + pitch up
      const canTakeoff = this.debug.airspeed > 65 && this.debug.alpha > 0.06;
      if (canTakeoff) {
        this.onGround = false;
        return wasAirborne ? null : 'takeoff';
      }
    } else if (this.state.position.y > gh + clearance + 0.5) {
      if (this.onGround) return 'takeoff';
      this.onGround = false;
    }

    // Tekerlek dönüşü
    if (this.onGround) {
      this.wheelSpin += this.debug.airspeed * dt * 0.5;
      const wheels = this.mesh.userData.wheels as THREE.Mesh[];
      for (const w of wheels) w.rotation.x = this.wheelSpin;
    }

    return null;
  }

  syncMesh(): void {
    this.mesh.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z
    );
    this.mesh.quaternion.set(
      this.state.orientation.x,
      this.state.orientation.y,
      this.state.orientation.z,
      this.state.orientation.w
    );

    // İniş takımı görünürlüğü (şimdilik hep açık)
    // Motor alevi
    const throttle = Math.max(0, Math.min(1, this.debug.airspeed / 200));
    const flames = this.mesh.userData.flames as THREE.Mesh[];
    for (const fl of flames) {
      (fl.material as THREE.MeshBasicMaterial).opacity = throttle > 0.1 ? 0.3 + Math.random() * 0.3 : 0;
    }
  }

  /** Dünya vektörünü uçağın gövde çerçevesine çevirir (HUD için) */
  worldToBody(worldVec: { x: number; y: number; z: number }) {
    // Bu fonksiyon HUD'un yerel bilgi göstermesi için kullanılabilir
    const { x, y, z } = this.state.orientation;
    const q = { x: -x, y: -y, z: -z, w: this.state.orientation.w };
    const vx = q.w * worldVec.x + q.y * worldVec.z - q.z * worldVec.y;
    const vy = q.w * worldVec.y + q.z * worldVec.x - q.x * worldVec.z;
    const vz = q.w * worldVec.z + q.x * worldVec.y - q.y * worldVec.x;
    const vw = -q.x * worldVec.x - q.y * worldVec.y - q.z * worldVec.z;
    return {
      x: vx * q.w + vw * -q.x + vy * -q.z - vz * -q.y,
      y: vy * q.w + vw * -q.y + vz * -q.x - vx * -q.z,
      z: vz * q.w + vw * -q.z + vx * -q.y - vy * -q.x
    };
  }
}

// Yardımcı: uçağın dünya hızının büyüklüğü
export const groundSpeed = (ac: Aircraft) => {
  const v = ac.state.velocity;
  return Math.hypot(v.x, v.z);
};

// Yardımcı: yerden yükseklik
export const altitudeAGL = (ac: Aircraft, groundH: number) => ac.state.position.y - groundH;

// Yardımcı: heading (derece)
export const headingDeg = (ac: Aircraft) => {
  const q = ac.state.orientation;
  const fwd = { x: 0, y: 0, z: -1 };
  // Manuel quaternion rotasyonu
  const ix = q.w * fwd.x + q.y * fwd.z - q.z * fwd.y;
  const iz = q.w * fwd.z + q.x * fwd.y - q.y * fwd.x;
  const iw = -q.x * fwd.x - q.y * fwd.y - q.z * fwd.z;
  const fx = ix * q.w + iw * -q.x + (q.w * fwd.y + q.z * fwd.x - q.x * fwd.z) * -q.z
           - (q.w * fwd.z + q.x * fwd.y - q.y * fwd.x) * -q.y;
  const fz = (q.w * fwd.z + q.x * fwd.y - q.y * fwd.x) * q.w + iw * -q.z
           + ix * -q.y - (q.w * fwd.y + q.z * fwd.x - q.x * fwd.z) * -q.x;
  let h = Math.atan2(fx, -fz) * 180 / Math.PI;
  return (h + 360) % 360;
};
