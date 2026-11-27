import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../config.js';

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'task-catalog.json'), 'utf8'));
const byId = new Map(catalog.diagnoses.flatMap((d) => d.tasks.map((t) => [t.id, t])));

/** Las tareas del catálogo se guardan como «@diagnostico.n»; el resto es texto libre. */
export const isCatalogTask = (s) => typeof s === 'string' && s.startsWith('@');
export const catalogHas = (id) => byId.has(id);
export const taskText = (s, lang = 'es') => (isCatalogTask(s) ? byId.get(s)?.[lang] || byId.get(s)?.es || s : s);
