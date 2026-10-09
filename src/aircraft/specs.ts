import type { AircraftSpec } from '../physics/FlightModel';

/**
 * Cessna 172S — hafif tek motorlu eğitim uçağı.
 * Kaynak: Cessna 172S POH (2004), Jane's All The World's Aircraft
 * Kalibrasyon hedefleri:
 *   Stall hızı (temiz): ~48 kt = 24.7 m/s
 *   Seyir hızı:         ~122 kt = 63 m/s
 *   Maksimum hız:       ~163 kt = 84 m/s
 *   Tırmanma oranı:     ~3.7 m/s @ deniz seviyesi
 */
export const CESSNA_172: AircraftSpec = {
  name: 'Cessna 172S',
  mass: 1043,
  wingArea: 16.2,
  wingSpan: 11.0,
  CL0: 0.25,
  CLalpha: 4.9,
  CLmax: 1.5,
  alphaStall: 0.28,     // ~16°
  CD0: 0.028,
  oswald: 0.75,
  maxThrust: 2400,      // ~180 hp @ 2400 rpm
  Ixx: 1300, Iyy: 1800, Izz: 2400,
  rollAuthority: 1800, pitchAuthority: 3200, yawAuthority: 1400,
  rollDamp: 900, pitchDamp: 1600, yawDamp: 700,
  pitchStability: 35,
  stallDropRate: 4.0
};

/**
 * F-16 Fighting Falcon (basitleştirilmiş).
 * Süpersonik, yüksek manevra kabiliyeti.
 */
export const F16: AircraftSpec = {
  name: 'F-16C',
  mass: 12000,
  wingArea: 27.9,
  wingSpan: 9.96,
  CL0: 0.0,
  CLalpha: 3.8,
  CLmax: 1.6,
  alphaStall: 0.42,     // ~24°
  CD0: 0.019,
  oswald: 0.80,
  maxThrust: 76000,     // AB'li
  Ixx: 12875, Iyy: 75574, Izz: 85552,
  rollAuthority: 42000, pitchAuthority: 32000, yawAuthority: 12000,
  rollDamp: 22000, pitchDamp: 28000, yawDamp: 9000,
  pitchStability: 200,
  stallDropRate: 3.0
};

export const SPECS = { cessna172: CESSNA_172, f16: F16 };
