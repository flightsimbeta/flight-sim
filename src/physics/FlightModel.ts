import {
  Vec3, Quat, v3, vAdd, vScale, vNorm,
  qRotate, qConj, qMul, qNorm
} from '../math';

/**
 * Uçak aerodinamik parametreleri.
 * Referans: Cessna 172S POH, NASA TN ve Roskam "Airplane Flight Dynamics"
 */
export interface AircraftSpec {
  name: string;
  mass: number;          // kg (yakıt + pilot dahil)
  wingArea: number;      // m²
  wingSpan: number;      // m
  CL0: number;           // sıfır AoA'da lift katsayısı
  CLalpha: number;       // lift eğimi (1/rad)
  CLmax: number;         // stall lift katsayısı
  alphaStall: number;    // stall açısı (rad)
  CD0: number;           // parazit sürükleme katsayısı
  oswald: number;        // Oswald verimlilik faktörü
  maxThrust: number;     // N @ deniz seviyesi
  Ixx: number; Iyy: number; Izz: number;  // atalet momentleri (kg·m²)
  rollAuthority: number; pitchAuthority: number; yawAuthority: number;
  rollDamp: number; pitchDamp: number; yawDamp: number;
  pitchStability: number; // AoA → pitch moment geri getirme
  stallDropRate: number;  // stall sonrası CL düşüş hızı
}

export interface AircraftState {
  position: Vec3;      // dünya konumu (m)
  velocity: Vec3;      // dünya hızı (m/s)
  orientation: Quat;   // gövde → dünya
  angularVel: Vec3;    // gövde açısal hız (rad/s)
}

export interface ControlInput {
  pitch: number;     // -1..1
  roll: number;      // -1..1
  yaw: number;       // -1..1
  throttle: number;  // 0..1
  flaps: number;     // 0..1
  gearDown: boolean;
  afterburner: boolean;
  brake: number;     // 0..1
}

export interface AeroDebug {
  alpha: number;      // rad
  beta: number;       // rad
  airspeed: number;   // m/s
  CL: number;
  CD: number;
  stalled: boolean;
  gForce: number;
  mach: number;
}

const V_FWD: Vec3 = { x: 0, y: 0, z: -1 };
const V_UP:  Vec3 = { x: 0, y: 1, z: 0 };
const _qdot: Quat = { x: 0, y: 0, z: 0, w: 0 };

/**
 * 6DOF uçuş modeli — gövde çerçevesi kuvvetleri hesaplar.
 *
 * Gövde eksenleri:
 *   +X = sağ kanat
 *   +Y = yukarı (kokpit)
 *   +Z = kuyruk
 *
 * Kuvvetler gövde çerçevesinde:
 *   Lift → +Y ekseni
 *   Drag → +Z ekseni (geri)
 *   Thrust → -Z ekseni (ileri)
 *
 * Sonra dünya çerçevesine döndürülür ve Newton yasası uygulanır.
 */
export function stepFlight(
  state: AircraftState,
  input: ControlInput,
  spec: AircraftSpec,
  dt: number,
  rho: number
): { state: AircraftState; debug: AeroDebug } {

  // === 1. Gövde eksenleri (dünya çerçevesinde) ===
  const fwdW = qRotate(state.orientation, V_FWD);
  const upW  = qRotate(state.orientation, V_UP);

  // === 2. Hızı gövde çerçevesine çevir ===
  const vBody = qRotate(qConj(state.orientation), state.velocity);
  const u = -vBody.z;   // ileri
  const v = vBody.x;    // sağa
  const w = -vBody.y;   // aşağı

  // === 3. Hava hızı ve açılar ===
  const airspeed = Math.hypot(u, v, w);
  const V = Math.max(0.1, airspeed);
  const alpha = Math.atan2(w, Math.max(0.5, u));           // hücum açısı
  const beta  = Math.asin(Math.max(-1, Math.min(1, v / V))); // yan kayma

  // === 4. Aerodinamik katsayılar ===
  let CL: number;
  let stalled = false;
  const absA = Math.abs(alpha);

  if (absA < spec.alphaStall) {
    CL = spec.CL0 + spec.CLalpha * alpha;
  } else {
    // Stall sonrası: CL üstel düşer (post-stall davranışı)
    stalled = true;
    const sign = Math.sign(alpha) || 1;
    const excess = absA - spec.alphaStall;
    CL = sign * spec.CLmax * Math.exp(-excess * spec.stallDropRate);
  }
  CL += input.flaps * 0.30;

  const AR = (spec.wingSpan * spec.wingSpan) / spec.wingArea;
  const CDi = (CL * CL) / (Math.PI * AR * spec.oswald);
  const CD = spec.CD0
           + CDi
           + (input.gearDown ? 0.020 : 0)
           + input.flaps * 0.040
           + (stalled ? 0.150 : 0);

  // === 5. Kuvvetler (gövde çerçevesi) ===
  const q_dyn = 0.5 * rho * V * V;
  const L = q_dyn * spec.wingArea * CL;
  const D = q_dyn * spec.wingArea * CD;

  // Yerdeyken tekerlek sürtünmesi ve fren
  const brakeForce = input.brake * spec.mass * 4.0;
  const rollingFriction = input.throttle < 0.05 ? spec.mass * 0.5 : 0;

  const T = spec.maxThrust * input.throttle * (input.afterburner ? 1.6 : 1);

  const Fbody: Vec3 = {
    x: 0,
    y: L,
    z: D - T + brakeForce + rollingFriction
  };

  // === 6. Dünya çerçevesi + yerçekimi ===
  const Fworld = qRotate(state.orientation, Fbody);
  Fworld.y -= spec.mass * 9.80665;

  // === 7. Doğrusal entegrasyon ===
  const accel = vScale(Fworld, 1 / spec.mass);
  const newVel = vAdd(state.velocity, vScale(accel, dt));
  const newPos = vAdd(state.position, vScale(newVel, dt));

  // === 8. Momentler (gövde çerçevesi) ===
  // Pitch stabilite: AoA büyüdükçe uçak burnunu indirir
  const pitchStab = -spec.pitchStability * alpha * q_dyn;
  // Yaw stabilite: sideslip → rüzgar gülü etkisi
  const yawStab   = -spec.pitchStability * 0.6 * beta * q_dyn;

  const Mx = input.roll  * spec.rollAuthority
           - spec.rollDamp  * state.angularVel.x;
  const My = input.yaw   * spec.yawAuthority
           - spec.yawDamp   * state.angularVel.y
           + yawStab;
  const Mz = input.pitch * spec.pitchAuthority
           - spec.pitchDamp * state.angularVel.z
           + pitchStab;

  const newAngVel: Vec3 = {
    x: state.angularVel.x + (Mx / spec.Ixx) * dt,
    y: state.angularVel.y + (My / spec.Iyy) * dt,
    z: state.angularVel.z + (Mz / spec.Izz) * dt
  };

  // === 9. Yönelim entegrasyonu: q' = ½ · ω ⊗ q ===
  _qdot.x = newAngVel.x;
  _qdot.y = newAngVel.y;
  _qdot.z = newAngVel.z;
  _qdot.w = 0;
  const qdot = qMul(_qdot, state.orientation);
  const newQ = qNorm({
    x: state.orientation.x + 0.5 * qdot.x * dt,
    y: state.orientation.y + 0.5 * qdot.y * dt,
    z: state.orientation.z + 0.5 * qdot.z * dt,
    w: state.orientation.w + 0.5 * qdot.w * dt
  });

  // === 10. G-kuvveti ve Mach ===
  const gForce = (L / (spec.mass * 9.80665)) + Math.abs(upW.y);
  const mach = V / 340.29;

  return {
    state: { position: newPos, velocity: newVel, orientation: newQ, angularVel: newAngVel },
    debug: { alpha, beta, airspeed, CL, CD, stalled, gForce, mach }
  };
}
