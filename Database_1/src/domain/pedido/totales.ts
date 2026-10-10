import { redondearImporte } from '../../utils/validation.js';
import type { Pedido, PedidoConTotal } from './types.js';

/**
 * Cálculo del total de un pedido. Función pura: mismo resultado para mismos
 * argumentos, sin efectos secundarios.
 */

/** Devuelve el importe total de un pedido (`cantidad × precio_unitario`). */
export function calcularTotalPedido(cantidad: number, precioUnitario: number): number {
  return redondearImporte(cantidad * precioUnitario);
}

/** Añade el campo `total` a un pedido. */
export function conTotal(pedido: Pedido): PedidoConTotal {
  return { ...pedido, total: calcularTotalPedido(pedido.cantidad, pedido.precio_unitario) };
}

/** Añade el campo `total` a una lista de pedidos. */
export function conTotales(pedidos: readonly Pedido[]): PedidoConTotal[] {
  return pedidos.map(conTotal);
}

/** Suma los totales de una lista de pedidos. */
export function sumarTotales(pedidos: readonly PedidoConTotal[]): number {
  return redondearImporte(pedidos.reduce((suma, pedido) => suma + pedido.total, 0));
}
