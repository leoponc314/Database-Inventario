import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { DatabaseConfig } from '../config/database.js';

/**
 * Abre (o crea) la base de datos SQLite descrita por `config`.
 *
 * Puntos clave:
 * - `foreign_keys = ON` es imprescindible para que las constraints se apliquen.
 *   SQLite las tiene DESACTIVADAS por conexión, por defecto.
 * - Se crea el directorio contenedor si no existe (necesario en el primer arranque).
 */
export function openDatabase(config: DatabaseConfig): Database.Database {
  // `:memory:` y `file::memory:` no tienen directorio asociado.
  if (!config.filename.startsWith('file::memory:') && config.filename !== ':memory:') {
    mkdirSync(dirname(config.filename), { recursive: true });
  }

  const db = new Database(config.filename, { verbose: config.verbose ? console.log : undefined });

  if (config.foreignKeys) {
    db.pragma('foreign_keys = ON');
  }

  // WAL mejora la concurrencia lectura/escritura y es seguro en local.
  if (config.filename !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  return db;
}

/** Cierra la base de datos de forma segura (ignora si ya estaba cerrada). */
export function closeDatabase(db: Database.Database): void {
  if (db.open) {
    db.close();
  }
}
