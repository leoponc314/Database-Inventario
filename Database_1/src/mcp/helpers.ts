import { AppError } from '../utils/errors.js';
import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * Helpers para las tools del servidor MCP.
 *
 * Regla de oro: un fallo de negocio (validación, no encontrado, stock
 * insuficiente) NO debe tumbar el servidor. Se devuelve como resultado con
 * `isError: true` para que el modelo pueda leer el mensaje y reaccionar.
 */

/** Construye un resultado exitoso con el dato serializado en JSON. */
export function ok(datos: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(datos, null, 2) }],
  };
}

/** Construye un resultado de error legible para el modelo. */
export function fallo(mensaje: string): CallToolResult {
  return {
    content: [{ type: 'text', text: mensaje }],
    isError: true,
  };
}

/**
 * Ejecuta una acción de negocio envolviéndola en manejo de errores.
 *
 * - `AppError` (validación, no encontrado, conflicto, stock) → resultado de
 *   error con su mensaje.
 * - Cualquier otro error inesperado → resultado de error genérico, sin filtrar
 *   detalles internos.
 */
export async function ejecutar(accion: () => unknown): Promise<CallToolResult> {
  try {
    const datos = accion();
    return ok(datos);
  } catch (error) {
    if (error instanceof AppError) {
      return fallo(error.message);
    }
    const mensaje = error instanceof Error ? error.message : 'Error desconocido.';
    return fallo(`Error inesperado: ${mensaje}`);
  }
}
