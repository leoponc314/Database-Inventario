import type { Pedido, PedidoInput } from './types.js';

/**
 * Puerto (interfaz) de persistencia para `pedido`.
 *
 * `crear` debe ser ATÓMICO: insertar el pedido y descontar el stock del
 * producto en una única transacción. Si algo falla, no se persiste nada.
 */
export interface PedidoRepository {
  /** Inserta un pedido y descuenta el stock en la misma transacción. */
  crear(input: Required<PedidoInput>): Pedido;

  /** Busca un pedido por id, o `null` si no existe. */
  porId(id: number): Pedido | null;

  /** Devuelve todos los pedidos. */
  listar(): Pedido[];

  /** Devuelve los pedidos de un cliente. */
  listarPorCliente(clienteId: number): Pedido[];

  /** Elimina un pedido. Devuelve `true` si borró alguna fila. */
  eliminar(id: number): boolean;
}
