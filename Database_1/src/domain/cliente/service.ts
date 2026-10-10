import { ConflictError, NotFoundError } from '../../utils/errors.js';
import type { ClienteRepository } from './repository.js';
import type { Cliente, ClienteInput, ClienteUpdate } from './types.js';
import { validarClienteInput, validarClienteUpdate } from './validacion.js';

/**
 * Casos de uso de `cliente`. Depende de la PUERTO `ClienteRepository`.
 */
export class ClienteService {
  constructor(private readonly repository: ClienteRepository) {}

  /** Valida y crea un cliente. Lanza `ConflictError` si el email ya existe. */
  crear(input: ClienteInput): Cliente {
    const validado = validarClienteInput(input);

    if (this.repository.existeEmail(validado.email)) {
      throw new ConflictError(`Ya existe un cliente con el email '${validado.email}'.`);
    }

    return this.repository.crear(validado);
  }

  /** Devuelve un cliente por id. Lanza `NotFoundError` si no existe. */
  porId(id: number): Cliente {
    const cliente = this.repository.porId(id);
    if (cliente === null) {
      throw new NotFoundError(`Cliente con id ${id} no encontrado.`);
    }
    return cliente;
  }

  /** Busca un cliente por email (case-insensitive). Devuelve `null` si no existe. */
  porEmail(email: string): Cliente | null {
    return this.repository.porEmail(email.trim().toLowerCase());
  }

  /** Lista todos los clientes. */
  listar(): Cliente[] {
    return this.repository.listar();
  }

  /** Actualiza un cliente parcialmente. Lanza `NotFoundError` si no existe. */
  actualizar(id: number, cambios: ClienteUpdate): Cliente {
    this.porId(id);
    validarClienteUpdate(cambios);

    // Si cambia el email, comprobamos que no choque con otro cliente.
    if (cambios.email !== undefined) {
      const emailNormalizado = cambios.email.trim().toLowerCase();
      const existente = this.repository.porEmail(emailNormalizado);
      if (existente !== null && existente.id !== id) {
        throw new ConflictError(`Ya existe otro cliente con el email '${emailNormalizado}'.`);
      }
    }

    const limpio = limpiarCambios(cambios);
    const actualizado = this.repository.actualizar(id, limpio);
    if (actualizado === null) {
      throw new NotFoundError(`Cliente con id ${id} no encontrado.`);
    }
    return actualizado;
  }

  /** Elimina un cliente. Lanza `NotFoundError` si no existe. */
  eliminar(id: number): void {
    const eliminado = this.repository.eliminar(id);
    if (!eliminado) {
      throw new NotFoundError(`Cliente con id ${id} no encontrado.`);
    }
  }
}

/** Elimina las claves con valor `undefined` para no sobreescribir con `NULL`. */
function limpiarCambios(cambios: ClienteUpdate): ClienteUpdate {
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor !== undefined) {
      limpio[clave] = valor;
    }
  }
  return limpio as ClienteUpdate;
}
