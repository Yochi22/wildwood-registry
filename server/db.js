import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');      // lecturas concurrentes + escrituras rápidas
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const migrations = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
     active INTEGER NOT NULL DEFAULT 1,
     token_version INTEGER NOT NULL DEFAULT 0,
     failed_attempts INTEGER NOT NULL DEFAULT 0,
     locked_until TEXT,
     totp_secret TEXT,
     totp_enabled INTEGER NOT NULL DEFAULT 0,
     totp_last_step INTEGER,
     last_login_at TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE dogs (
     id INTEGER PRIMARY KEY,
     reg_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
     status TEXT NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
     photo TEXT,
     owner_name TEXT NOT NULL,
     microchip TEXT,
     dog_name TEXT NOT NULL,
     breed TEXT,
     specialty TEXT NOT NULL,
     country TEXT NOT NULL,
     issue_date TEXT NOT NULL,
     expiry_date TEXT,
     lifetime INTEGER NOT NULL DEFAULT 0,
     tasks TEXT NOT NULL DEFAULT '[]',
     notes TEXT,
     created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX idx_dogs_microchip ON dogs(microchip);
   CREATE INDEX idx_dogs_status ON dogs(status);
   CREATE INDEX idx_dogs_expiry ON dogs(expiry_date);
   CREATE INDEX idx_dogs_created ON dogs(created_at);
   CREATE INDEX idx_dogs_owner ON dogs(owner_name);
   CREATE INDEX idx_dogs_name ON dogs(dog_name);
   CREATE TABLE audit_log (
     id INTEGER PRIMARY KEY,
     user_id INTEGER,
     user_email TEXT,
     action TEXT NOT NULL,
     entity TEXT,
     entity_id TEXT,
     details TEXT,
     ip TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX idx_audit_created ON audit_log(created_at);
   CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);`,
];

const current = db.pragma('user_version', { simple: true });
for (let v = current; v < migrations.length; v++) {
  db.transaction(() => {
    db.exec(migrations[v]);
    db.pragma(`user_version = ${v + 1}`);
  })();
}

export function audit(req, action, entity, entityId, details) {
  db.prepare(
    `INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, details, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req?.user?.id ?? null,
    req?.user?.email ?? details?.email ?? null,
    action,
    entity ?? null,
    entityId != null ? String(entityId) : null,
    details ? JSON.stringify(details) : null,
    req?.ip ?? null
  );
}
