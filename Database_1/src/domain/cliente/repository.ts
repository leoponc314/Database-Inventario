import type { Cliente, ClienteInput, ClienteUpdate } from './types.js';

/**
 * Puerto (interfaz) de persistencia para `cliente`.
 */
export interface ClienteRepository {
  /** Inserta un cliente ya validado y devuelve la entidad creada. */
  crear(input: Required<ClienteInput>): Cliente;

  /** Busca un cliente por id, o `null` si no existe. */
  porId(id: number): Cliente | null;

  /** Busca un cliente por email (case-insensitive), o `null` si no existe. */
  porEmail(email: string): Cliente | null;

  /** Devuelve `true` si ya existe un cliente con ese email. */
  existeEmail(email: string): boolean;

  /** Devuelve todos los clientes. */
  listar(): Cliente[];

  /** Aplica los cambios parciales y devuelve la entidad, o `null` si no existe. */
  actualizar(id: number, cambios: ClienteUpdate): Cliente | null;

  /** Elimina un cliente. Devuelve `true` si borró alguna fila. */
  eliminar(id: number): boolean;
}
