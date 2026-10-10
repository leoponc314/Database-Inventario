import type Database from 'better-sqlite3';
import type { ProductoRepository } from '../../domain/producto/repository.js';
import type { Producto, ProductoInput, ProductoUpdate } from '../../domain/producto/types.js';
import { aEntero, activoDeFila } from './mappers.js';

interface FilaProducto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  activo: number;
  created_at: string;
}

/** Implementación SQLite del puerto `ProductoRepository`. */
export class SqliteProductoRepository implements ProductoRepository {
  constructor(private readonly db: Database.Database) {}

  crear(input: Required<ProductoInput>): Producto {
    const resultado = this.db
      .prepare(
        `INSERT INTO producto (nombre, descripcion, precio, stock, activo, created_at)
         VALUES (@nombre, @descripcion, @precio, @stock, @activo, @created_at)`,
      )
      .run({
        nombre: input.nombre,
        descripcion: input.descripcion,
        precio: input.precio,
        stock: input.stock,
        activo: aEntero(input.activo),
        created_at: new Date().toISOString(),
      });

    const creado = this.porId(Number(resultado.lastInsertRowid));
    if (creado === null) {
      throw new Error('El producto recién insertado no se pudo recuperar.');
    }
    return creado;
  }

  porId(id: number): Producto | null {
    const fila = this.db
      .prepare<[number], FilaProducto>('SELECT * FROM producto WHERE id = ?')
      .get(id);
    return fila ? aProducto(fila) : null;
  }

  listar(opts: { soloActivos?: boolean } = {}): Producto[] {
    const sql = opts.soloActivos
      ? 'SELECT * FROM producto WHERE activo = 1 ORDER BY id'
      : 'SELECT * FROM producto ORDER BY id';
    const filas = this.db.prepare<[], FilaProducto>(sql).all();
    return filas.map(aProducto);
  }

  buscarPorNombre(nombre: string): Producto[] {
    const filas = this.db
      .prepare<[string], FilaProducto>(
        `SELECT * FROM producto
         WHERE nombre LIKE ? ESCAPE '\\'
         ORDER BY nombre`,
      )
      .all(prepararPatronLike(nombre));
    return filas.map(aProducto);
  }

  actualizar(id: number, cambios: ProductoUpdate): Producto | null {
    const permitidos: (keyof ProductoUpdate)[] = [
      'nombre',
      'descripcion',
      'precio',
      'stock',
      'activo',
    ];
    const campos = permitidos.filter((campo) => cambios[campo] !== undefined);

    if (campos.length === 0) {
      return this.porId(id);
    }

    // Construimos el SET de forma segura: solo columnas conocidas.
    const asignaciones = campos.map((campo) => `${String(campo)} = @${String(campo)}`).join(', ');
    const parametros: Record<string, unknown> = { id };

    for (const campo of campos) {
      const valor = cambios[campo];
      if (campo === 'activo') {
        parametros.activo = aEntero(valor as boolean);
      } else {
        parametros[String(campo)] = valor;
      }
    }

    this.db.prepare(`UPDATE producto SET ${asignaciones} WHERE id = @id`).run(parametros);
    return this.porId(id);
  }

  eliminar(id: number): boolean {
    const resultado = this.db.prepare<[number]>('DELETE FROM producto WHERE id = ?').run(id);
    return resultado.changes > 0;
  }

  descontarStock(id: number, cantidad: number): boolean {
    // Solo descuenta si queda stock suficiente (evita carreras y negativos).
    const resultado = this.db
      .prepare<[number, number, number]>(
        `UPDATE producto SET stock = stock - ?
         WHERE id = ? AND stock >= ?`,
      )
      .run(cantidad, id, cantidad);
    return resultado.changes > 0;
  }
}

/** Convierte una fila de SQLite en la entidad `Producto`. */
function aProducto(fila: FilaProducto): Producto {
  return activoDeFila(fila);
}

/** Escapa los caracteres especiales de LIKE y envuelve el patrón en `%`. */
function prepararPatronLike(termino: string): string {
  const escapado = termino.trim().replace(/[\\%_]/g, '\\$&');
  return `%${escapado}%`;
}
