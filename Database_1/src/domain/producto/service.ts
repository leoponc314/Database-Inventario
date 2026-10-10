import { NotFoundError } from '../../utils/errors.js';
import type { ProductoRepository } from './repository.js';
import type { Producto, ProductoInput, ProductoUpdate } from './types.js';
import { validarProductoInput, validarProductoUpdate } from './validacion.js';

/**
 * Casos de uso de `producto`.
 *
 * Depende de la PUERTO `ProductoRepository`, nunca de SQLite. Así puede
 * probarse con un repositorio falso en memoria (tests unitarios).
 */
export class ProductoService {
  constructor(private readonly repository: ProductoRepository) {}

  /** Valida y crea un producto. Lanza `ValidationError` si los datos no son válidos. */
  crear(input: ProductoInput): Producto {
    const validado = validarProductoInput(input);
    return this.repository.crear(validado);
  }

  /** Devuelve un producto por id. Lanza `NotFoundError` si no existe. */
  porId(id: number): Producto {
    const producto = this.repository.porId(id);
    if (producto === null) {
      throw new NotFoundError(`Producto con id ${id} no encontrado.`);
    }
    return producto;
  }

  /** Lista productos. Con `soloActivos` omite los dados de baja. */
  listar(opts: { soloActivos?: boolean } = {}): Producto[] {
    return this.repository.listar(opts);
  }

  /** Busca productos por nombre parcial, sin distinguir mayúsculas. */
  buscarPorNombre(nombre: string): Producto[] {
    return this.repository.buscarPorNombre(nombre);
  }

  /** Actualiza un producto parcialmente. Lanza `NotFoundError` si no existe. */
  actualizar(id: number, cambios: ProductoUpdate): Producto {
    this.porId(id); // garantiza existencia con un error claro
    validarProductoUpdate(cambios);

    const limpio = limpiarCambios(cambios);
    const actualizado = this.repository.actualizar(id, limpio);
    if (actualizado === null) {
      throw new NotFoundError(`Producto con id ${id} no encontrado.`);
    }
    return actualizado;
  }

  /** Elimina un producto. Lanza `NotFoundError` si no existe. */
  eliminar(id: number): void {
    const eliminado = this.repository.eliminar(id);
    if (!eliminado) {
      throw new NotFoundError(`Producto con id ${id} no encontrado.`);
    }
  }
}

/** Elimina las claves con valor `undefined` para no sobreescribir con `NULL`. */
function limpiarCambios(cambios: ProductoUpdate): ProductoUpdate {
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor !== undefined) {
      limpio[clave] = valor;
    }
  }
  return limpio as ProductoUpdate;
}
