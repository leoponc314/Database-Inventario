import type { ClienteRepository } from '../../src/domain/cliente/repository.js';
import type { Cliente, ClienteInput, ClienteUpdate } from '../../src/domain/cliente/types.js';
import type { PedidoRepository } from '../../src/domain/pedido/repository.js';
import type { Pedido, PedidoInput } from '../../src/domain/pedido/types.js';
import type { ProductoRepository } from '../../src/domain/producto/repository.js';
import type { Producto, ProductoInput, ProductoUpdate } from '../../src/domain/producto/types.js';
import { InsufficientStockError } from '../../src/utils/errors.js';

/**
 * Repositorios FALSOS en memoria para tests unitarios.
 *
 * Permiten probar los servicios SIN SQLite. Reproducen las reglas mínimas del
 * dominio (por ejemplo, descuento condicional de stock) para que el test sea
 * fiel al comportamiento real.
 */

/** Contador global para asignar ids únicos entre fakes. */
let siguienteId = 1;
const nuevoId = (): number => siguienteId++;

export class FakeProductoRepository implements ProductoRepository {
  private readonly productos = new Map<number, Producto>();

  /** Inserta directamente un producto (útil para preparar tests). */
  insertar(producto: Partial<Omit<Producto, 'id' | 'created_at'>> = {}): Producto {
    const entidad: Producto = {
      id: nuevoId(),
      nombre: producto.nombre ?? 'Producto',
      descripcion: producto.descripcion ?? null,
      precio: producto.precio ?? 10,
      stock: producto.stock ?? 100,
      activo: producto.activo ?? true,
      created_at: new Date().toISOString(),
    };
    this.productos.set(entidad.id, entidad);
    return entidad;
  }

  crear(input: Required<ProductoInput>): Producto {
    const entidad: Producto = {
      id: nuevoId(),
      nombre: input.nombre,
      descripcion: input.descripcion,
      precio: input.precio,
      stock: input.stock,
      activo: input.activo,
      created_at: new Date().toISOString(),
    };
    this.productos.set(entidad.id, entidad);
    return entidad;
  }

  porId(id: number): Producto | null {
    return this.productos.get(id) ?? null;
  }

  listar(opts: { soloActivos?: boolean } = {}): Producto[] {
    const todos = [...this.productos.values()];
    return opts.soloActivos ? todos.filter((p) => p.activo) : todos;
  }

  buscarPorNombre(nombre: string): Producto[] {
    const termino = nombre.toLowerCase();
    return [...this.productos.values()].filter((p) => p.nombre.toLowerCase().includes(termino));
  }

  actualizar(id: number, cambios: ProductoUpdate): Producto | null {
    const existente = this.productos.get(id);
    if (!existente) return null;
    const actualizado: Producto = { ...existente, ...cambios, id: existente.id };
    this.productos.set(id, actualizado);
    return actualizado;
  }

  eliminar(id: number): boolean {
    return this.productos.delete(id);
  }

  descontarStock(id: number, cantidad: number): boolean {
    const producto = this.productos.get(id);
    if (!producto || producto.stock < cantidad) return false;
    this.productos.set(id, { ...producto, stock: producto.stock - cantidad });
    return true;
  }
}

export class FakeClienteRepository implements ClienteRepository {
  private readonly clientes = new Map<number, Cliente>();

  insertar(cliente: Partial<ClienteInput> = {}): Cliente {
    const entidad: Cliente = {
      id: nuevoId(),
      nombre: cliente.nombre ?? 'Cliente',
      email: cliente.email ?? `cliente${nuevoId()}@example.com`,
      telefono: cliente.telefono ?? null,
      created_at: new Date().toISOString(),
    };
    this.clientes.set(entidad.id, entidad);
    return entidad;
  }

  crear(input: Required<ClienteInput>): Cliente {
    const entidad: Cliente = {
      id: nuevoId(),
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
      created_at: new Date().toISOString(),
    };
    this.clientes.set(entidad.id, entidad);
    return entidad;
  }

  porId(id: number): Cliente | null {
    return this.clientes.get(id) ?? null;
  }

  porEmail(email: string): Cliente | null {
    const buscado = email.trim().toLowerCase();
    return [...this.clientes.values()].find((c) => c.email.toLowerCase() === buscado) ?? null;
  }

  existeEmail(email: string): boolean {
    return this.porEmail(email) !== null;
  }

  listar(): Cliente[] {
    return [...this.clientes.values()];
  }

  actualizar(id: number, cambios: ClienteUpdate): Cliente | null {
    const existente = this.clientes.get(id);
    if (!existente) return null;
    const actualizado: Cliente = { ...existente, ...cambios, id: existente.id };
    this.clientes.set(id, actualizado);
    return actualizado;
  }

  eliminar(id: number): boolean {
    return this.clientes.delete(id);
  }
}

export class FakePedidoRepository implements PedidoRepository {
  private readonly pedidos = new Map<number, Pedido>();
  /** Referencia al fake de productos para simular el descuento de stock. */
  constructor(private readonly productos: FakeProductoRepository) {}

  crear(input: Required<PedidoInput>): Pedido {
    // Reproduce la regla de negocio: falla si no hay stock suficiente.
    const producto = this.productos.porId(input.producto_id);
    if (!producto || producto.stock < input.cantidad) {
      throw new InsufficientStockError(input.producto_id, producto?.stock ?? 0, input.cantidad);
    }
    this.productos.descontarStock(input.producto_id, input.cantidad);

    const entidad: Pedido = {
      id: nuevoId(),
      cliente_id: input.cliente_id,
      producto_id: input.producto_id,
      cantidad: input.cantidad,
      precio_unitario: input.precio_unitario,
      created_at: new Date().toISOString(),
    };
    this.pedidos.set(entidad.id, entidad);
    return entidad;
  }

  porId(id: number): Pedido | null {
    return this.pedidos.get(id) ?? null;
  }

  listar(): Pedido[] {
    return [...this.pedidos.values()];
  }

  listarPorCliente(clienteId: number): Pedido[] {
    return [...this.pedidos.values()].filter((p) => p.cliente_id === clienteId);
  }

  eliminar(id: number): boolean {
    return this.pedidos.delete(id);
  }
}
