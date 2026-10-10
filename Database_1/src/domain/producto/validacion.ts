import { ValidationError } from '../../utils/errors.js';
import {
  esEnteroNoNegativo,
  esNumeroNoNegativo,
  esTextoNoVacio,
  normalizarTexto,
} from '../../utils/validation.js';
import type { ProductoInput, ProductoUpdate } from './types.js';

/**
 * Reglas de validación del producto. Funciones puras que lanzan
 * `ValidationError` con un mensaje claro si los datos no son válidos.
 */

export const NOMBRE_MAX_LENGTH = 200;
export const DESCRIPCION_MAX_LENGTH = 1000;

/**
 * Valida los datos de creación de un producto y devuelve una copia normalizada
 * (textos recortados, `descripcion` vacía convertida a `null`).
 */
export function validarProductoInput(input: ProductoInput): Required<ProductoInput> {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Los datos del producto son obligatorios.');
  }

  if (!esTextoNoVacio(input.nombre)) {
    throw new ValidationError('El nombre del producto es obligatorio.');
  }

  const nombre = normalizarTexto(input.nombre);
  if (nombre.length > NOMBRE_MAX_LENGTH) {
    throw new ValidationError(
      `El nombre del producto no puede superar ${NOMBRE_MAX_LENGTH} caracteres.`,
    );
  }

  if (!esNumeroNoNegativo(input.precio)) {
    throw new ValidationError('El precio del producto debe ser un número mayor o igual a 0.');
  }

  if (!esEnteroNoNegativo(input.stock)) {
    throw new ValidationError('El stock del producto debe ser un número entero mayor o igual a 0.');
  }

  if (
    input.descripcion !== undefined &&
    input.descripcion !== null &&
    typeof input.descripcion !== 'string'
  ) {
    throw new ValidationError('La descripción del producto debe ser texto o null.');
  }

  const descripcionNormalizada =
    input.descripcion == null ? null : normalizarTexto(input.descripcion);
  // Tras normalizar, una descripción vacía se trata como ausente (null).
  const descripcion = descripcionNormalizada === '' ? null : descripcionNormalizada;
  if (descripcion !== null && descripcion.length > DESCRIPCION_MAX_LENGTH) {
    throw new ValidationError(
      `La descripción del producto no puede superar ${DESCRIPCION_MAX_LENGTH} caracteres.`,
    );
  }

  if (input.activo !== undefined && typeof input.activo !== 'boolean') {
    throw new ValidationError("El campo 'activo' del producto debe ser booleano.");
  }

  return {
    nombre,
    descripcion,
    precio: input.precio,
    stock: input.stock,
    activo: input.activo ?? true,
  };
}

/** Valida los cambios de una actualización parcial. Devuelve `true` si hay algo que cambiar. */
export function validarProductoUpdate(update: ProductoUpdate): boolean {
  if (update === null || typeof update !== 'object') {
    throw new ValidationError('Los datos de actualización del producto son obligatorios.');
  }

  const campos = Object.keys(update).filter(
    (campo) => update[campo as keyof ProductoUpdate] !== undefined,
  );
  if (campos.length === 0) {
    throw new ValidationError('No hay campos para actualizar en el producto.');
  }

  for (const campo of campos) {
    switch (campo) {
      case 'nombre':
      case 'descripcion':
      case 'precio':
      case 'stock':
      case 'activo':
        break;
      default:
        throw new ValidationError(`Campo no permitido en la actualización: '${campo}'.`);
    }
  }

  return true;
}
