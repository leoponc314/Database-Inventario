import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { DatabaseError } from '../utils/errors.js';

/**
 * Migraciones SQL basadas en ficheros.
 *
 * - Cada fichero `NNN_nombre.sql` se aplica UNA sola vez.
 * - El orden lo determina el nombre del fichero (prefijo numérico).
 * - Cada migración se ejecuta dentro de una transacción: o se aplica entera o no.
 *
 * Es un enfoque deliberadamente simple y suficiente para una base local.
 */

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  nombre      TEXT PRIMARY KEY,
  aplicada_en TEXT NOT NULL
);
`;

export interface Migracion {
  readonly nombre: string;
  readonly sql: string;
}

/**
 * Carga y ordena las migraciones disponibles en `dir`.
 * Los ficheros deben llamarse `NNN_algo.sql` para ordenar correctamente.
 */
export function cargarMigraciones(dir: string): Migracion[] {
  const archivos = readdirSync(dir);

  return archivos
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort()
    .map((archivo) => ({
      nombre: archivo,
      sql: readFileSync(join(dir, archivo), 'utf8'),
    }));
}

/** Devuelve los nombres de migraciones ya aplicadas. */
function obtenerMigracionesAplicadas(db: Database.Database): Set<string> {
  db.exec(MIGRATIONS_TABLE_SQL);
  const filas = db.prepare<[], { nombre: string }>('SELECT nombre FROM schema_migrations').all();
  return new Set(filas.map((fila) => fila.nombre));
}

/**
 * Aplica todas las migraciones pendientes de forma idempotente.
 * Devuelve los nombres de las migraciones aplicadas en esta ejecución.
 */
export function ejecutarMigraciones(db: Database.Database, migraciones: Migracion[]): string[] {
  const aplicadas = obtenerMigracionesAplicadas(db);
  const pendientes = migraciones.filter((migracion) => !aplicadas.has(migracion.nombre));

  const registrar = db.prepare('INSERT INTO schema_migrations (nombre, aplicada_en) VALUES (?, ?)');
  const ejecutadas: string[] = [];

  const transaccion = db.transaction((migracion: Migracion): void => {
    db.exec(migracion.sql);
    registrar.run(migracion.nombre, new Date().toISOString());
  });

  for (const migracion of pendientes) {
    try {
      transaccion(migracion);
      ejecutadas.push(migracion.nombre);
    } catch (error) {
      throw new DatabaseError(
        `Falló la migración '${migracion.nombre}': ${(error as Error).message}`,
        {
          cause: error,
        },
      );
    }
  }

  return ejecutadas;
}

/** Carga y aplica las migraciones de `dir`. Atajo cómodo para composición raíz. */
export function migrar(db: Database.Database, dir: string): string[] {
  return ejecutarMigraciones(db, cargarMigraciones(dir));
}
