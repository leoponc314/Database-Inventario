import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Configuración de la base de datos.
 *
 * Es un objeto puro y fácil de inyectar en tests: basta con pasar otro
 * `filename` (por ejemplo `':memory:'`) para no tocar la base real.
 */

export interface DatabaseConfig {
  /** Ruta del archivo SQLite, o `':memory:'` para una base en memoria. */
  readonly filename: string;
  /** Directorio que contiene los ficheros `.sql` de migración. */
  readonly migrationsDir: string;
  /** Activa la comprobación de foreign keys (debe ser `true` en producción). */
  readonly foreignKeys: boolean;
  /** Registro de sentencias SQL para depuración. */
  readonly verbose: boolean;
}

/**
 * Directorio raíz del proyecto.
 *
 * No basta con subir dos niveles desde este fichero: tras `tsc` este módulo
 * vive en `dist/config/`, así que `../..` apuntaría a `dist/`. Buscamos el
 * `package.json` más cercano para localizar la raíz real sea cual sea el
 * emplazamiento (src/ o dist/).
 */
function findProjectRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'package.json'))) {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
      };
      // Ignora los package.json internos de node_modules.
      if (pkg.name !== undefined) {
        return dir;
      }
    }
    const padre = resolve(dir, '..');
    if (padre === dir) break;
    dir = padre;
  }
  // Último recurso: el directorio de trabajo.
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();

/**
 * Directorio de migraciones por defecto.
 *
 * En desarrollo las migraciones viven en `src/database/migrations`; en el
 * build compilado se copian a `dist/database/migrations`. Elegimos la ruta
 * que exista, priorizando `src/`.
 */
function resolveDefaultMigrationsDir(): string {
  const candidatas = [
    join(PROJECT_ROOT, 'src', 'database', 'migrations'),
    join(PROJECT_ROOT, 'dist', 'database', 'migrations'),
  ];
  return candidatas.find((ruta) => existsSync(ruta)) ?? candidatas[0]!;
}

/** Directorio por defecto de migraciones. */
export const DEFAULT_MIGRATIONS_DIR = resolveDefaultMigrationsDir();

/** Archivo SQLite por defecto dentro de `data/`. */
export const DEFAULT_DATABASE_FILE = join(PROJECT_ROOT, 'data', 'database.sqlite');

/**
 * Crea una configuración combinando valores por defecto con overrides parciales.
 * Función pura: no lee variables de entorno por sí misma.
 */
export function createDatabaseConfig(overrides: Partial<DatabaseConfig> = {}): DatabaseConfig {
  return {
    filename: DEFAULT_DATABASE_FILE,
    migrationsDir: DEFAULT_MIGRATIONS_DIR,
    foreignKeys: true,
    verbose: false,
    ...overrides,
  };
}
