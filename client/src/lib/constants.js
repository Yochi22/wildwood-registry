export const SPECIALTIES = ['service_dog', 'psychiatric_service', 'emotional_support', 'medical_alert', 'diabetic_alert', 'seizure_alert', 'mobility', 'hearing', 'guide', 'autism_support', 'ptsd_support', 'therapy'];
export const ROLES = ['admin', 'editor', 'viewer'];
const RANK = { viewer: 1, editor: 2, admin: 3 };
export const can = (user, role) => !!user && RANK[user.role] >= RANK[role];

// ISO 3166-1 alfa-2. El nombre se muestra traducido con Intl.DisplayNames.
export const COUNTRIES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GI GL GM GN GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS YE ZA ZM ZW'.split(' ');

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const addYears = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
};
export const daysUntil = (iso, from = todayISO()) => Math.round((new Date(`${iso}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 864e5);

/** Misma regla que el servidor; solo para la vista previa del formulario. */
export function computeState(d, t = todayISO()) {
  if (d.status === 'inactive') return 'inactive';
  if (d.issue_date && d.issue_date > t) return 'pending';
  if (d.lifetime) return 'lifetime';
  if (!d.expiry_date || d.expiry_date < t) return 'expired';
  return 'active';
}

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
