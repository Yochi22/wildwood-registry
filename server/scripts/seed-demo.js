// Datos de ejemplo para probar el panel. NO usar en producción.
import { db } from '../db.js';
import { generateRegNumber } from '../lib/regnumber.js';
import { today, addDays, addYears } from '../lib/status.js';
import { SPECIALTIES } from '../lib/constants.js';

const n = Number(process.argv[2] || 60);
const dogs = ['Luna', 'Max', 'Kira', 'Toby', 'Nala', 'Rocky', 'Mía', 'Canela', 'Zeus', 'Olivia', 'Duke', 'Sasha', 'Bruno', 'Coco', 'Thor', 'Lola', 'Simba', 'Maya', 'Bimba', 'Rex'];
const breeds = ['Golden Retriever', 'Labrador', 'Pastor Alemán', 'Border Collie', 'Caniche', 'Beagle', 'Mestizo', 'Bulldog Francés', 'Husky Siberiano', 'Cocker Spaniel'];
const owners = ['María Fernanda Ríos', 'Jorge Peña', 'Esteban Morales', 'Paula Díaz', 'Ana Lucía Vega', 'Tomás Cárdenas', 'Valentina Cruz', 'Lucía Méndez', 'Gabriel Soto', 'Mariana León', 'Isabel Quintero', 'Camilo Rueda'];
const countries = ['CO', 'MX', 'ES', 'US', 'AR', 'CL', 'PE', 'PA', 'EC'];
const pick = (a, i) => a[i % a.length];
const t = today();
const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
const ins = db.prepare(
  `INSERT INTO dogs (reg_number,status,owner_name,microchip,dog_name,breed,specialty,country,issue_date,expiry_date,lifetime,tasks,created_by,updated_by,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);
db.transaction(() => {
  for (let i = 0; i < n; i++) {
    const issue = addDays(t, -Math.floor(Math.random() * 700) + (i % 17 === 0 ? 20 : 0));
    const lifetime = i % 9 === 0 ? 1 : 0;
    let expiry = lifetime ? null : addYears(issue, i % 4 === 0 ? 2 : 1);
    if (i % 11 === 0 && !lifetime) expiry = addDays(t, (i % 25) + 1);
    ins.run(
      generateRegNumber(), i % 13 === 5 ? 'inactive' : 'active', pick(owners, i * 7),
      i % 6 === 3 ? null : String(985112000000000 + i * 7919), pick(dogs, i), pick(breeds, i * 3), pick(SPECIALTIES, i * 5),
      pick(countries, i), issue, expiry, lifetime,
      JSON.stringify(['Interrumpir crisis de ansiedad con presión profunda', 'Recordar la toma de medicación', 'Crear espacio personal en lugares concurridos'].slice(0, (i % 3) + 1)),
      admin?.id ?? null, admin?.id ?? null, `${issue} 10:00:00`
    );
  }
})();
console.log(`${n} perros de ejemplo creados.`);
