/**
 * Mappers puros entre filas de SQLite y entidades de dominio.
 *
 * SQLite no tiene tipo booleano: se guarda como INTEGER 0/1. Aquí se
 * centraliza la conversión para no repetirla en cada repositorio.
 */

interface FilaEntero {
  readonly activo: number;
}

/** Convierte un entero 0/1 de SQLite en booleano. */
export function aBooleano(valor: number): boolean {
  return valor === 1;
}

/** Convierte un booleano en el entero 0/1 que espera SQLite. */
export function aEntero(valor: boolean): number {
  return valor ? 1 : 0;
}

/** Extrae el campo `activo` de una fila y lo convierte en booleano. */
export function activoDeFila<F extends FilaEntero>(
  fila: F,
): Omit<F, 'activo'> & { activo: boolean } {
  const { activo, ...resto } = fila;
  return { ...resto, activo: aBooleano(activo) };
}
