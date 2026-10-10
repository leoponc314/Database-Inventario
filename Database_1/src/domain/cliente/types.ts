/**
 * Tipos del dominio `cliente`.
 */

/** Entidad `cliente` tal como se modela en el negocio. */
export interface Cliente {
  readonly id: number;
  readonly nombre: string;
  readonly email: string;
  readonly telefono: string | null;
  readonly created_at: string;
}

/** Datos necesarios para crear un cliente. */
export interface ClienteInput {
  readonly nombre: string;
  readonly email: string;
  readonly telefono?: string | null;
}

/** Cambios parciales al actualizar un cliente. */
export type ClienteUpdate = Partial<ClienteInput>;
