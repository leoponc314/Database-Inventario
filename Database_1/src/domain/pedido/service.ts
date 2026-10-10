import type { ClienteRepository } from '../cliente/repository.js';
import type { ProductoRepository } from '../producto/repository.js';
import { NotFoundError, InsufficientStockError, ValidationError } from '../../utils/errors.js';
import type { PedidoRepository } from './repository.js';
import type { Pedido, PedidoConTotal, PedidoInput } from './types.js';
import { validarPedidoInput } from './validacion.js';
import { conTotal, conTotales, sumarTotales } from './totales.js';

/**
 * Casos de uso de `pedido`.
 *
 * Coordina tres repositorios: valida que el cliente y el producto existen,
 * comprueba el stock y delega en el repositorio la creación ATÓMICA
 * (pedido + descuento de stock en una transacción).
 */
export class PedidoService {
  constructor(
    private readonly pedidos: PedidoRepository,
    private readonly clientes: ClienteRepository,
    private readonly productos: ProductoRepository,
  ) {}

  /**
   * Crea un pedido validando todas las reglas de negocio:
   * - el cliente y el producto deben existir,
   * - el producto debe estar activo,
   * - debe haber stock suficiente,
   * - y la creación es atómica (pedido + descuento de stock).
   */
  crear(input: PedidoInput): PedidoConTotal {
    const validado = validarPedidoInput(input);

    const cliente = this.clientes.porId(validado.cliente_id);
    if (cliente === null) {
      throw new NotFoundError(`Cliente con id ${validado.cliente_id} no encontrado.`);
    }

    const producto = this.productos.porId(validado.producto_id);
    if (producto === null) {
      throw new NotFoundError(`Producto con id ${validado.producto_id} no encontrado.`);
    }

    if (!producto.activo) {
      throw new ValidationError(
        `El producto '${producto.nombre}' está inactivo y no puede venderse.`,
      );
    }

    if (producto.stock < validado.cantidad) {
      throw new InsufficientStockError(producto.id, producto.stock, validado.cantidad);
    }

    // Si no se indicó precio, se usa el vigente del producto.
    const precioUnitario =
      validado.precio_unitario === 0 ? producto.precio : validado.precio_unitario;

    const pedido = this.pedidos.crear({
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: validado.cantidad,
      precio_unitario: precioUnitario,
    });

    return conTotal(pedido);
  }

  /** Devuelve un pedido con su total. Lanza `NotFoundError` si no existe. */
  porId(id: number): PedidoConTotal {
    const pedido = this.pedidos.porId(id);
    if (pedido === null) {
      throw new NotFoundError(`Pedido con id ${id} no encontrado.`);
    }
    return conTotal(pedido);
  }

  /** Lista todos los pedidos con su total. */
  listar(): PedidoConTotal[] {
    return conTotales(this.pedidos.listar());
  }

  /** Lista los pedidos de un cliente con su total. */
  listarPorCliente(clienteId: number): PedidoConTotal[] {
    return conTotales(this.pedidos.listarPorCliente(clienteId));
  }

  /** Suma el importe total de los pedidos de un cliente. */
  totalPorCliente(clienteId: number): number {
    return sumarTotales(this.listarPorCliente(clienteId));
  }

  /** Suma el importe total de todos los pedidos. */
  totalGeneral(): number {
    return sumarTotales(this.listar());
  }

  /** Elimina un pedido. Lanza `NotFoundError` si no existe. */
  eliminar(id: number): void {
    const eliminado = this.pedidos.eliminar(id);
    if (!eliminado) {
      throw new NotFoundError(`Pedido con id ${id} no encontrado.`);
    }
  }
}

/** Re-exporta el tipo `Pedido` para comodidad de los consumidores del módulo. */
export type { Pedido };
