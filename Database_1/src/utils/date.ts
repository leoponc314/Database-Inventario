/**
 * Utilidades de fecha. La marca `created_at` se guarda en ISO-8601 UTC,
 * que ordena lexicográficamente igual que cronológicamente.
 */

/** Devuelve la fecha y hora actual en formato ISO-8601 UTC. */
export function fechaActualIso(): string {
  return new Date().toISOString();
}

/** Parsea una fecha ISO y devuelve un `Date`, o `null` si no es válida. */
export function parsearIso(valor: string): Date | null {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
