/**
 * Tipos del dominio `producto`.
 *
 * Son interfaces puras: sin dependencias de SQLite ni de la capa de persistencia.
 */

/** Entidad `producto` tal como se modela en el negocio. */
export interface Producto {
  readonly id: number;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly precio: number;
  readonly stock: number;
  readonly activo: boolean;
  readonly created_at: string;
}

/** Datos necesarios para crear un producto (sin `id` ni `created_at`). */
export interface ProductoInput {
  readonly nombre: string;
  readonly descripcion?: string | null;
  readonly precio: number;
  readonly stock: number;
  readonly activo?: boolean;
}

/** Cambios parciales al actualizar un producto. */
export type ProductoUpdate = Partial<ProductoInput>;
