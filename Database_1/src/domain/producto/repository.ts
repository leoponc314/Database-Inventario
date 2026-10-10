import type { Producto, ProductoInput, ProductoUpdate } from './types.js';

/**
 * Puerto (interfaz) de persistencia para `producto`.
 *
 * El dominio define QUÉ necesita; la implementación SQLite decide CÓMO.
 * Permite testear los servicios con fakes en memoria, sin tocar SQLite.
 */
export interface ProductoRepository {
  /** Inserta un producto ya validado y devuelve la entidad creada. */
  crear(input: Required<ProductoInput>): Producto;

  /** Busca un producto por id, o `null` si no existe. */
  porId(id: number): Producto | null;

  /** Devuelve todos los productos (opcionalmente solo activos). */
  listar(opts?: { soloActivos?: boolean }): Producto[];

  /** Busca productos cuyo nombre contenga `nombre` (case-insensitive). */
  buscarPorNombre(nombre: string): Producto[];

  /** Aplica los cambios parciales y devuelve la entidad, o `null` si no existe. */
  actualizar(id: number, cambios: ProductoUpdate): Producto | null;

  /** Elimina un producto. Devuelve `true` si borró alguna fila. */
  eliminar(id: number): boolean;

  /** Descuenta `cantidad` del stock. Devuelve `false` si no hay stock suficiente. */
  descontarStock(id: number, cantidad: number): boolean;
}
