/**
 * Tipos del dominio `pedido`.
 */

/** Entidad `pedido` tal como se modela en el negocio. */
export interface Pedido {
  readonly id: number;
  readonly cliente_id: number;
  readonly producto_id: number;
  readonly cantidad: number;
  readonly precio_unitario: number;
  readonly created_at: string;
}

/** Datos necesarios para crear un pedido. */
export interface PedidoInput {
  readonly cliente_id: number;
  readonly producto_id: number;
  readonly cantidad: number;
  /** Si se omite, se usa el precio vigente del producto. */
  readonly precio_unitario?: number;
}

/** Un pedido con su importe total precalculado. */
export interface PedidoConTotal extends Pedido {
  readonly total: number;
}
