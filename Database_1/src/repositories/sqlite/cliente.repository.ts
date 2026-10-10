import type Database from 'better-sqlite3';
import type { ClienteRepository } from '../../domain/cliente/repository.js';
import type { Cliente, ClienteInput, ClienteUpdate } from '../../domain/cliente/types.js';

interface FilaCliente {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  created_at: string;
}

/** Implementación SQLite del puerto `ClienteRepository`. */
export class SqliteClienteRepository implements ClienteRepository {
  constructor(private readonly db: Database.Database) {}

  crear(input: Required<ClienteInput>): Cliente {
    const resultado = this.db
      .prepare(
        `INSERT INTO cliente (nombre, email, telefono, created_at)
         VALUES (@nombre, @email, @telefono, @created_at)`,
      )
      .run({
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        created_at: new Date().toISOString(),
      });

    const creado = this.porId(Number(resultado.lastInsertRowid));
    if (creado === null) {
      throw new Error('El cliente recién insertado no se pudo recuperar.');
    }
    return creado;
  }

  porId(id: number): Cliente | null {
    const fila = this.db
      .prepare<[number], FilaCliente>('SELECT * FROM cliente WHERE id = ?')
      .get(id);
    return fila ?? null;
  }

  porEmail(email: string): Cliente | null {
    const fila = this.db
      .prepare<[string], FilaCliente>('SELECT * FROM cliente WHERE email = ? COLLATE NOCASE')
      .get(email.trim().toLowerCase());
    return fila ?? null;
  }

  existeEmail(email: string): boolean {
    const fila = this.db
      .prepare<[string], { existe: number }>(
        'SELECT 1 AS existe FROM cliente WHERE email = ? COLLATE NOCASE',
      )
      .get(email.trim().toLowerCase());
    return fila !== undefined;
  }

  listar(): Cliente[] {
    return this.db.prepare<[], FilaCliente>('SELECT * FROM cliente ORDER BY id').all();
  }

  actualizar(id: number, cambios: ClienteUpdate): Cliente | null {
    const permitidos: (keyof ClienteUpdate)[] = ['nombre', 'email', 'telefono'];
    const campos = permitidos.filter((campo) => cambios[campo] !== undefined);

    if (campos.length === 0) {
      return this.porId(id);
    }

    const asignaciones = campos.map((campo) => `${String(campo)} = @${String(campo)}`).join(', ');
    const parametros: Record<string, unknown> = { id };
    for (const campo of campos) {
      parametros[String(campo)] = cambios[campo];
    }

    this.db.prepare(`UPDATE cliente SET ${asignaciones} WHERE id = @id`).run(parametros);
    return this.porId(id);
  }

  eliminar(id: number): boolean {
    const resultado = this.db.prepare<[number]>('DELETE FROM cliente WHERE id = ?').run(id);
    return resultado.changes > 0;
  }
}
