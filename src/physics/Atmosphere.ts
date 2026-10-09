/**
 * ISA (International Standard Atmosphere) basitleştirilmiş model.
 * Troposferde (0-11km) sıcaklık lineer düşer, basınç üstel azalır.
 */
export function airDensity(altitudeMeters: number): number {
  const T0 = 288.15;       // K, deniz seviyesi sıcaklık
  const L  = 0.0065;       // K/m, sıcaklık gradyanı
  const p0 = 101325;       // Pa, deniz seviyesi basınç
  const R  = 287.058;      // J/(kg·K), özgül gaz sabiti
  const g  = 9.80665;      // m/s²
  const alt = Math.max(0, Math.min(altitudeMeters, 20000));
  const T = Math.max(216.65, T0 - L * alt);
  const p = p0 * Math.pow(1 - (L * alt) / T0, g / (R * L));
  return p / (R * T);
}

export const SEA_LEVEL_DENSITY = airDensity(0); // ≈ 1.225 kg/m³
