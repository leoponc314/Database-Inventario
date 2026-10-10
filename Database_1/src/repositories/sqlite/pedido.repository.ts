import type Database from 'better-sqlite3';
import { InsufficientStockError } from '../../utils/errors.js';
import type { PedidoRepository } from '../../domain/pedido/repository.js';
import type { Pedido, PedidoInput } from '../../domain/pedido/types.js';

interface FilaPedido {
  id: number;
  cliente_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  created_at: string;
}

/**
 * Implementación SQLite del puerto `PedidoRepository`.
 *
 * `crear` es la pieza con una transacción real:
 * 1. Se inserta el pedido.
 * 2. Se descuenta el stock solo si queda suficiente.
 * 3. Si no hay stock, se lanza `InsufficientStockError` y better-sqlite3
 *    hace ROLLBACK automático de todo lo hecho dentro de `transaction()`.
 */
export class SqlitePedidoRepository implements PedidoRepository {
  constructor(private readonly db: Database.Database) {}

  crear(input: Required<PedidoInput>): Pedido {
    const insertar = this.db.transaction((datos: Required<PedidoInput>): number => {
      const resultado = this.db
        .prepare(
          `INSERT INTO pedido (cliente_id, producto_id, cantidad, precio_unitario, created_at)
           VALUES (@cliente_id, @producto_id, @cantidad, @precio_unitario, @created_at)`,
        )
        .run({
          cliente_id: datos.cliente_id,
          producto_id: datos.producto_id,
          cantidad: datos.cantidad,
          precio_unitario: datos.precio_unitario,
          created_at: new Date().toISOString(),
        });

      // Descuento condicional: solo si el stock alcanza.
      const descuento = this.db
        .prepare<[number, number, number]>(
          `UPDATE producto SET stock = stock - ?
           WHERE id = ? AND stock >= ?`,
        )
        .run(datos.cantidad, datos.producto_id, datos.cantidad);

      if (descuento.changes === 0) {
        const fila = this.db
          .prepare<[number], { stock: number }>('SELECT stock FROM producto WHERE id = ?')
          .get(datos.producto_id);
        const stockActual = fila?.stock ?? 0;
        throw new InsufficientStockError(datos.producto_id, stockActual, datos.cantidad);
      }

      return Number(resultado.lastInsertRowid);
    });

    const id = insertar(input);

    const creado = this.porId(id);
    if (creado === null) {
      throw new Error('El pedido recién insertado no se pudo recuperar.');
    }
    return creado;
  }

  porId(id: number): Pedido | null {
    const fila = this.db.prepare<[number], FilaPedido>('SELECT * FROM pedido WHERE id = ?').get(id);
    return fila ?? null;
  }

  listar(): Pedido[] {
    return this.db.prepare<[], FilaPedido>('SELECT * FROM pedido ORDER BY id').all();
  }

  listarPorCliente(clienteId: number): Pedido[] {
    return this.db
      .prepare<[number], FilaPedido>('SELECT * FROM pedido WHERE cliente_id = ? ORDER BY id')
      .all(clienteId);
  }

  eliminar(id: number): boolean {
    const resultado = this.db.prepare<[number]>('DELETE FROM pedido WHERE id = ?').run(id);
    return resultado.changes > 0;
  }
}
