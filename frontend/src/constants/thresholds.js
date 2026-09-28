/**
 * Single source of truth for bridge sensor thresholds, engineering standards,
 * units, and status evaluation across the application.
 *
 * Engineering Standards Reference:
 * - Vibration: IRC:6-2017 Clause 204 / 219 (Live load vibration & dynamic limits) -> Limit: 1.20 g
 * - Strain: IRC:112-2011 Section 12 (Serviceability Limit State tensile strain) -> Limit: 210.0 MPa
 * - Crack Gap: IRC:112-2011 Table 12.1 / IRC:SP:44-1996 (Crack control in concrete bridges) -> Limit: 0.30 mm, Warn: 0.20 mm
 * - Water Level: IRC:6-2017 Clause 213 / CWC Flood Standards -> Flood Danger limit: 5.50 m, Watch: 4.00 m
 */

export const SENSOR_THRESHOLDS = {
  water_level: {
    warn: 4.0,
    crit: 5.5,
    unit: 'm',
    label: 'Water level',
    standard: 'IRC:6-2017 Cl. 213 / CWC (5.50m limit)',
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

export const CRACK_GAP_LIMIT_MM = SENSOR_THRESHOLDS.crack_gap.crit; // 0.30 mm
export const CRACK_GAP_WARN_MM = SENSOR_THRESHOLDS.crack_gap.warn;  // 0.20 mm

export const WATER_LEVEL_LIMIT_M = SENSOR_THRESHOLDS.water_level.crit; // 5.50 m
export const WATER_LEVEL_WARN_M = SENSOR_THRESHOLDS.water_level.warn;  // 4.00 m

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

/**
 * Structural Risk Index thresholds:
 * Low: < 40%
 * Moderate: 40–70%
 * High: > 70%
 */
export const RISK_THRESHOLDS = {
  low: { max: 40, label: 'Low risk', status: 'Healthy', color: '#0F6E56', badgeBg: '#F0FDF4', badgeBorder: '#DCFCE7' },
  moderate: { min: 40, max: 70, label: 'Moderate risk', status: 'Monitor', color: '#D97706', badgeBg: '#FFFBEB', badgeBorder: '#FEF3C7' },
  high: { min: 70, label: 'High risk', status: 'Critical', color: '#991B1B', badgeBg: '#FDF2F2', badgeBorder: '#FECACA' },
};

/**
 * Returns standardized risk severity based on numeric risk score/percentage:
 * <40% => Healthy (Low risk)
 * 40–70% => Monitor (Moderate risk)
 * >70% => Critical (High risk)
 */
export function getRiskSeverity(riskScoreOrPercent) {
  if (riskScoreOrPercent == null) {
    return {
      status: 'Healthy',
      label: 'Low risk',
      color: '#0F6E56',
      badgeBg: '#F0FDF4',
      badgeBorder: '#DCFCE7',
      isCritical: false,
      isWarning: false,
      isHealthy: true,
      riskPct: 0,
    };
  }

  const num = Number(riskScoreOrPercent);
  const pct = !isNaN(num) && num <= 1.0 && num > 0 ? num * 100 : num;

  if (pct > 70) {
    return {
      status: 'Critical',
      label: 'High risk',
      color: '#991B1B',
      badgeBg: '#FDF2F2',
      badgeBorder: '#FECACA',
      isCritical: true,
      isWarning: false,
      isHealthy: false,
      riskPct: pct,
    };
  }
  if (pct >= 40) {
    return {
      status: 'Monitor',
      label: 'Moderate risk',
      color: '#D97706',
      badgeBg: '#FFFBEB',
      badgeBorder: '#FEF3C7',
      isCritical: false,
      isWarning: true,
      isHealthy: false,
      riskPct: pct,
    };
  }
  return {
    status: 'Healthy',
    label: 'Low risk',
    color: '#0F6E56',
    badgeBg: '#F0FDF4',
    badgeBorder: '#DCFCE7',
    isCritical: false,
    isWarning: false,
    isHealthy: true,
    riskPct: pct,
  };
}
