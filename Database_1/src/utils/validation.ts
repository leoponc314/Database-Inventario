/**
 * Funciones puras de validación compartidas por todos los módulos de dominio.
 * No arrojan errores por sí mismas: devuelven `boolean` o `string` normalizado.
 * La decisión de lanzar `ValidationError` vive en las capas de dominio.
 */

/** Normaliza un string: recorta espacios y colapsa espacios internos múltiples. */
export function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

/** Devuelve `true` si el string recortado no está vacío. */
export function esTextoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && normalizarTexto(valor).length > 0;
}

/** Valida un email con un patrón estricto y razonable. */
export function esEmailValido(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const limpio = email.trim();
  if (limpio.length === 0 || limpio.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio);
}

/** Devuelve `true` si el valor es un número entero >= 0. */
export function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
}

/** Devuelve `true` si el valor es un número entero estrictamente positivo. */
export function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
}

/** Devuelve `true` si el valor es un número finito y no negativo. */
export function esNumeroNoNegativo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
}

/** Devuelve `true` si el valor es un `id` válido (entero positivo). */
export function esIdValido(valor: unknown): valor is number {
  return esEnteroPositivo(valor);
}

/** Redondea un importe monetario a 2 decimales (evita errores de coma flotante). */
export function redondearImporte(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
