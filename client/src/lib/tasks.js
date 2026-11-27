import catalog from '../../../shared/task-catalog.json';

export const DIAGNOSES = catalog.diagnoses;
const byId = new Map(DIAGNOSES.flatMap((d) => d.tasks.map((t) => [t.id, t])));

/** Tarea del catálogo («@diagnostico.n») traducida al idioma; texto libre tal cual. */
export const taskText = (s, lang) => (typeof s === 'string' && s.startsWith('@') ? byId.get(s)?.[lang] || byId.get(s)?.es || s : s);
