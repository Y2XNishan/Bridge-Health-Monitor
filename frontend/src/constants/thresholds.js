/**
 * Single source of truth for bridge sensor thresholds, engineering standards,
 * units, and status evaluation across the application.
 *
 * Engineering Standards Reference:
 * - Vibration: IRC:6-2017 Clause 204 / 219 (Live load vibration & dynamic limits) -> Limit: 1.20 g
 * - Strain: IRC:112-2011 Section 12 (Serviceability Limit State tensile strain) -> Limit: 210.0 MPa
 * - Crack Gap: IRC:112-2011 Table 12.1 / IRC:SP:44-1996 (Crack control in concrete bridges) -> Limit: 0.30 mm, Warn: 0.20 mm
 * - Water Level: NHAI / CWC Flood Warning (Flood threshold: 4.50 m, Critical: 5.50 m)
 */

export const SENSOR_THRESHOLDS = {
  water_level: {
    warn: 4.0,
    crit: 5.5,
    unit: 'm',
    label: 'Water level',
    standard: 'Flood Threshold (4.50m / 5.50m)',
  },
  vibration: {
    warn: 0.8,
    crit: 1.2,
    unit: 'g',
    label: 'Vibration',
    standard: 'IRC:6-2017 (1.20g limit)',
  },
  strain: {
    warn: 180.0,
    crit: 210.0,
    unit: 'MPa',
    label: 'Strain',
    standard: 'IRC:112-2011 (210.0 MPa limit)',
  },
  crack_gap: {
    warn: 0.20,
    crit: 0.30,
    unit: 'mm',
    label: 'Crack gap',
    standard: 'IRC:112-2011 Table 12.1 (0.30mm limit)',
  },
};

/**
 * Returns standardized status string: 'Critical', 'Monitor', or 'Healthy'
 */
export function getSensorStatus(sensor, value) {
  if (value == null) return 'Offline';
  const t = SENSOR_THRESHOLDS[sensor];
  if (!t) return 'Healthy';
  if (value >= t.crit) return 'Critical';
  if (value >= t.warn) return 'Monitor';
  return 'Healthy';
}

/**
 * Returns standardized uppercase alert level: 'CRITICAL', 'WARNING', or 'NORMAL'
 */
export function getSensorAlertLevel(sensor, value) {
  if (value == null) return 'NORMAL';
  const t = SENSOR_THRESHOLDS[sensor];
  if (!t) return 'NORMAL';
  if (value >= t.crit) return 'CRITICAL';
  if (value >= t.warn) return 'WARNING';
  return 'NORMAL';
}
