import { ValidationError } from '../../utils/errors.js';
import { esEmailValido, esTextoNoVacio, normalizarTexto } from '../../utils/validation.js';
import type { ClienteInput, ClienteUpdate } from './types.js';

/**
 * Reglas de validación del cliente. Funciones puras que lanzan
 * `ValidationError` si los datos no son válidos.
 */

export const NOMBRE_MAX_LENGTH = 200;
export const TELEFONO_MAX_LENGTH = 30;

/**
 * Valida los datos de creación de un cliente y devuelve una copia normalizada
 * (textos recortados, email en minúsculas, teléfono vacío convertido a `null`).
 */
export function validarClienteInput(input: ClienteInput): Required<ClienteInput> {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Los datos del cliente son obligatorios.');
  }

  if (!esTextoNoVacio(input.nombre)) {
    throw new ValidationError('El nombre del cliente es obligatorio.');
  }

  const nombre = normalizarTexto(input.nombre);
  if (nombre.length > NOMBRE_MAX_LENGTH) {
    throw new ValidationError(
      `El nombre del cliente no puede superar ${NOMBRE_MAX_LENGTH} caracteres.`,
    );
  }

  if (!esTextoNoVacio(input.email) || !esEmailValido(input.email)) {
    throw new ValidationError('El email del cliente no es válido.');
  }

  const email = normalizarTexto(input.email).toLowerCase();

  if (
    input.telefono !== undefined &&
    input.telefono !== null &&
    typeof input.telefono !== 'string'
  ) {
    throw new ValidationError('El teléfono del cliente debe ser texto o null.');
  }

  const telefonoNormalizado = input.telefono == null ? null : normalizarTexto(input.telefono);
  // Tras normalizar, un teléfono vacío se trata como ausente (null).
  const telefono = telefonoNormalizado === '' ? null : telefonoNormalizado;
  if (telefono !== null) {
    if (telefono.length > TELEFONO_MAX_LENGTH) {
      throw new ValidationError(
        `El teléfono del cliente no puede superar ${TELEFONO_MAX_LENGTH} caracteres.`,
      );
    }
    if (!/^[+0-9()\s.-]+$/.test(telefono)) {
      throw new ValidationError(
        'El teléfono del cliente solo puede contener dígitos y los símbolos + ( ) - .',
      );
    }
  }

  return { nombre, email, telefono };
}

/** Valida los cambios de una actualización parcial. Devuelve `true` si hay algo que cambiar. */
export function validarClienteUpdate(update: ClienteUpdate): boolean {
  if (update === null || typeof update !== 'object') {
    throw new ValidationError('Los datos de actualización del cliente son obligatorios.');
  }

  const campos = Object.keys(update).filter(
    (campo) => update[campo as keyof ClienteUpdate] !== undefined,
  );
  if (campos.length === 0) {
    throw new ValidationError('No hay campos para actualizar en el cliente.');
  }

  for (const campo of campos) {
    if (campo !== 'nombre' && campo !== 'email' && campo !== 'telefono') {
      throw new ValidationError(`Campo no permitido en la actualización: '${campo}'.`);
    }
  }

  return true;
}
