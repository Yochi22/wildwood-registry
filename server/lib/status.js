import { config } from '../config.js';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del centro. */
export function today(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addYears(iso, years) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export const EXPIRING_DAYS = 30;

/**
 * Estado de una credencial. Prioridad:
 * inactiva > aún no vigente > vitalicia > vencida > vigente.
 */
export function computeState(d, t = today()) {
  if (d.status === 'inactive') return 'inactive';
  if (d.issue_date > t) return 'pending';
  if (d.lifetime) return 'lifetime';
  if (!d.expiry_date || d.expiry_date < t) return 'expired';
  return 'active';
}

export function daysUntil(iso, t = today()) {
  if (!iso) return null;
  return Math.round((new Date(`${iso}T00:00:00Z`) - new Date(`${t}T00:00:00Z`)) / 864e5);
}

/** Las mismas reglas en SQL, para filtrar y contar en la base de datos. */
export const STATE_SQL = {
  inactive: `d.status = 'inactive'`,
  pending: `d.status = 'active' AND d.issue_date > @today`,
  lifetime: `d.status = 'active' AND d.issue_date <= @today AND d.lifetime = 1`,
  expired: `d.status = 'active' AND d.issue_date <= @today AND d.lifetime = 0 AND (d.expiry_date IS NULL OR d.expiry_date < @today)`,
  active: `d.status = 'active' AND d.issue_date <= @today AND d.lifetime = 0 AND d.expiry_date >= @today`,
  expiring: `d.status = 'active' AND d.issue_date <= @today AND d.lifetime = 0 AND d.expiry_date BETWEEN @today AND @soon`,
};
STATE_SQL.valid = `((${STATE_SQL.active}) OR (${STATE_SQL.lifetime}))`;
