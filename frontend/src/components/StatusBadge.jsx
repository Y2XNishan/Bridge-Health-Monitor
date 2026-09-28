import React from 'react';

/**
 * Standardized Status Badge for BridgeIQ design system.
 * Renders a circular status dot and sentence-case label with unified padding,
 * radius, and muted functional colors:
 * - Critical: pale red (#FDF2F2), muted red border (#FECACA), dark red dot (#991B1B)
 * - Monitor: pale amber (#FFFBEB), muted amber border (#FEF3C7), amber dot (#D97706)
 * - Healthy: pale teal (#F0FDF4), muted teal border (#DCFCE7), teal dot (#0F6E56)
 *
 * Text is charcoal (#1C1F26) across all statuses.
 */

export function normalizeStatus(status, healthScore) {
  if (healthScore !== undefined && healthScore !== null && !isNaN(healthScore)) {
    const num = Number(healthScore);
    if (num < 50) return 'Critical';
    if (num < 75) return 'Monitor';
    return 'Healthy';
  }

  const s = String(status || '').trim().toUpperCase();
  if (['CRITICAL', 'FAIL', 'HIGH', 'DANGER', 'SEVERE'].includes(s)) {
    return 'Critical';
  }
  if (['WARNING', 'MONITOR', 'WATCH', 'MODERATE', 'POOR', 'FAIR', 'MEDIUM'].includes(s)) {
    return 'Monitor';
  }
  return 'Healthy';
}

const STATUS_CONFIG = {
  Critical: {
    bg: '#FDF2F2',
    border: '#FECACA',
    dot: '#991B1B',
    text: '#1C1F26',
    label: 'Critical',
  },
  Monitor: {
    bg: '#FFFBEB',
    border: '#FEF3C7',
    dot: '#D97706',
    text: '#1C1F26',
    label: 'Monitor',
  },
  Healthy: {
    bg: '#F0FDF4',
    border: '#DCFCE7',
    dot: '#0F6E56',
    text: '#1C1F26',
    label: 'Healthy',
  },
};

export default function StatusBadge({
  status,
  healthScore,
  label,
  className = '',
  style = {},
  size = 'md', // 'sm' | 'md'
}) {
  const normalized = normalizeStatus(status, healthScore);
  const cfg = STATUS_CONFIG[normalized] || STATUS_CONFIG.Healthy;
  const displayLabel = label || cfg.label;

  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium font-sans border shrink-0 transition-colors select-none ${
        isSmall ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'
      } ${className}`}
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.text,
        lineHeight: 1.2,
        ...style,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.dot }}
      />
      <span>{displayLabel}</span>
    </span>
  );
}

/**
 * Standardized health score formatter across all pages.
 * Displays number formatted to 1 decimal place.
 */
export function formatHealthScore(score) {
  if (score === null || score === undefined || isNaN(score)) return '—';
  return Number(score).toFixed(1);
}
