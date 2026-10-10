import { ValidationError } from '../../utils/errors.js';
import { esEnteroPositivo, esIdValido, esNumeroNoNegativo } from '../../utils/validation.js';
import type { PedidoInput } from './types.js';

/**
 * Reglas de validación del pedido. Funciones puras que lanzan `ValidationError`.
 */

/** Valida los datos de creación de un pedido y devuelve una copia normalizada. */
export function validarPedidoInput(input: PedidoInput): Required<PedidoInput> {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Los datos del pedido son obligatorios.');
  }

  if (!esIdValido(input.cliente_id)) {
    throw new ValidationError('El id del cliente debe ser un número entero positivo.');
  }

  if (!esIdValido(input.producto_id)) {
    throw new ValidationError('El id del producto debe ser un número entero positivo.');
  }

  if (!esEnteroPositivo(input.cantidad)) {
    throw new ValidationError('La cantidad del pedido debe ser un número entero mayor que 0.');
  }

  if (input.precio_unitario !== undefined && !esNumeroNoNegativo(input.precio_unitario)) {
    throw new ValidationError(
      'El precio unitario del pedido debe ser un número mayor o igual a 0.',
    );
  }

  return {
    cliente_id: input.cliente_id,
    producto_id: input.producto_id,
    cantidad: input.cantidad,
    precio_unitario: input.precio_unitario ?? 0,
  };
}
