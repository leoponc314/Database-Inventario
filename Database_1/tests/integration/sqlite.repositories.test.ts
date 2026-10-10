import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, closeDatabase } from '../../src/database/connection.js';
import { createDatabaseConfig } from '../../src/config/database.js';
import { migrar } from '../../src/database/migrations.js';
import { SqliteProductoRepository } from '../../src/repositories/sqlite/producto.repository.js';
import { SqliteClienteRepository } from '../../src/repositories/sqlite/cliente.repository.js';
import { SqlitePedidoRepository } from '../../src/repositories/sqlite/pedido.repository.js';
import type { Aplicacion } from '../../src/index.js';
import { crearAplicacion } from '../../src/index.js';
import { InsufficientStockError } from '../../src/utils/errors.js';
import type Database from 'better-sqlite3';

/**
 * Tests de integración: usan una base SQLite REAL en memoria (`:memory:`).
 * Cada test arranca con el esquema limpio, gracias a que `:memory:` es
 * efímera por conexión.
 */

let db: Database.Database;
let productoRepo: SqliteProductoRepository;
let clienteRepo: SqliteClienteRepository;
let pedidoRepo: SqlitePedidoRepository;

beforeEach(() => {
  db = openDatabase(createDatabaseConfig({ filename: ':memory:' }));
  migrar(db, createDatabaseConfig().migrationsDir);
  productoRepo = new SqliteProductoRepository(db);
  clienteRepo = new SqliteClienteRepository(db);
  pedidoRepo = new SqlitePedidoRepository(db);
});

afterEach(() => {
  closeDatabase(db);
});

/** Helper: crea un producto directamente por el repositorio. */
function crearProducto(overrides: Partial<Parameters<SqliteProductoRepository['crear']>[0]> = {}) {
  return productoRepo.crear({
    nombre: 'Producto base',
    descripcion: null,
    precio: 10,
    stock: 100,
    activo: true,
    ...overrides,
  });
}

/** Helper: crea un cliente directamente por el repositorio. */
function crearCliente(email = 'cliente@example.com') {
  return clienteRepo.crear({ nombre: 'Cliente', email, telefono: null });
}

describe('esquema (migraciones)', () => {
  it('crea las tres tablas', () => {
    const tablas = db
      .prepare<[], { name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('producto','cliente','pedido')`,
      )
      .all()
      .map((fila) => fila.name)
      .sort();

    expect(tablas).toEqual(['cliente', 'pedido', 'producto']);
  });

  it('el email del cliente es UNIQUE', () => {
    crearCliente('dup@example.com');
    expect(() => crearCliente('dup@example.com')).toThrow();
  });

  it('las foreign keys de pedido apuntan a cliente y producto', () => {
    // pragma_foreign_key_list ya expone las columnas 'table', 'from' y 'to'.
    const claves = db
      .prepare<[], { table: string; from: string; to: string }>(
        `SELECT "table", "from", "to" FROM pragma_foreign_key_list('pedido')`,
      )
      .all();

    const pares = claves.map((c) => `${c.from}->${c.table}`);
    expect(pares).toContain('cliente_id->cliente');
    expect(pares).toContain('producto_id->producto');
  });

  it('rechaza un pedido con cliente inexistente (FK activa)', () => {
    const producto = crearProducto();
    expect(() =>
      pedidoRepo.crear({
        cliente_id: 9999,
        producto_id: producto.id,
        cantidad: 1,
        precio_unitario: 10,
      }),
    ).toThrow();
  });

  it('las migraciones son idempotentes', () => {
    const segundaVez = migrar(db, createDatabaseConfig().migrationsDir);
    expect(segundaVez).toEqual([]);
  });
});

describe('SqliteProductoRepository', () => {
  it('crea y recupera un producto', () => {
    const producto = crearProducto({ nombre: 'Monitor', precio: 249, stock: 30 });

    const recuperado = productoRepo.porId(producto.id);
    expect(recuperado?.nombre).toBe('Monitor');
    expect(recuperado?.precio).toBe(249);
    expect(recuperado?.stock).toBe(30);
    // El booleano se roundtrippe correctamente (0/1 -> boolean).
    expect(recuperado?.activo).toBe(true);
  });

  it('porId devuelve null si no existe', () => {
    expect(productoRepo.porId(9999)).toBeNull();
  });

  it('listar devuelve todos ordenados por id', () => {
    crearProducto({ nombre: 'A' });
    crearProducto({ nombre: 'B' });
    expect(productoRepo.listar().map((p) => p.nombre)).toEqual(['A', 'B']);
  });

  it('listar soloActivos omite los inactivos', () => {
    crearProducto({ nombre: 'Activo', activo: true });
    crearProducto({ nombre: 'Inactivo', activo: false });
    expect(productoRepo.listar({ soloActivos: true })).toHaveLength(1);
  });

  it('buscarPorNombre hace coincidencia parcial sin distinguir mayúsculas', () => {
    crearProducto({ nombre: 'Teclado Mecánico' });
    crearProducto({ nombre: 'Ratón' });

    expect(productoRepo.buscarPorNombre('teclado')).toHaveLength(1);
    // La diferencia 'mecánico' vs 'Mecánico' es solo ASCII, que LIKE sí pliega.
    expect(productoRepo.buscarPorNombre('mecánico')).toHaveLength(1);
    expect(productoRepo.buscarPorNombre('portátil')).toHaveLength(0);
  });

  it('buscarPorNombre NO pliega el caso de caracteres no ASCII (limitación de SQLite)', () => {
    crearProducto({ nombre: 'Teclado Mecánico' });

    // LIKE/NOCASE de SQLite solo plega ASCII: 'Á' ≠ 'á'. Lo documentamos para
    // que el comportamiento sea explícito y no una sorpresa en producción.
    expect(productoRepo.buscarPorNombre('MECÁNICO')).toHaveLength(0);
  });

  it('buscarPorNombre escapa los caracteres comodín de LIKE', () => {
    crearProducto({ nombre: '100% algodón' });
    crearProducto({ nombre: 'Camiseta' });

    // Un '%' literal no debe actuar como comodín.
    expect(productoRepo.buscarPorNombre('100%')).toHaveLength(1);
  });

  it('actualiza campos parciales', () => {
    const producto = crearProducto({ nombre: 'SSD', precio: 99, stock: 50 });
    const actualizado = productoRepo.actualizar(producto.id, { precio: 79.9 });

    expect(actualizado?.precio).toBe(79.9);
    expect(actualizado?.nombre).toBe('SSD');
  });

  it('actualizar devuelve null si no existe', () => {
    expect(productoRepo.actualizar(9999, { precio: 1 })).toBeNull();
  });

  it('eliminar borra y devuelve true', () => {
    const producto = crearProducto();
    expect(productoRepo.eliminar(producto.id)).toBe(true);
    expect(productoRepo.porId(producto.id)).toBeNull();
  });

  it('eliminar devuelve false si no existe', () => {
    expect(productoRepo.eliminar(9999)).toBe(false);
  });

  it('descontarStock solo descuenta si hay stock suficiente', () => {
    const producto = crearProducto({ stock: 5 });

    expect(productoRepo.descontarStock(producto.id, 3)).toBe(true);
    expect(productoRepo.porId(producto.id)?.stock).toBe(2);

    // Ya no queda stock para 3 unidades: no descuenta nada.
    expect(productoRepo.descontarStock(producto.id, 3)).toBe(false);
    expect(productoRepo.porId(producto.id)?.stock).toBe(2);
  });
});

describe('SqliteClienteRepository', () => {
  it('crea y recupera un cliente', () => {
    const cliente = crearCliente('ana@example.com');
    const recuperado = clienteRepo.porId(cliente.id);

    expect(recuperado?.email).toBe('ana@example.com');
    expect(recuperado?.telefono).toBeNull();
  });

  it('porEmail es case-insensitive', () => {
    crearCliente('ana@example.com');
    expect(clienteRepo.porEmail('ANA@EXAMPLE.COM')?.email).toBe('ana@example.com');
  });

  it('existeEmail detecta duplicados', () => {
    crearCliente('ana@example.com');
    expect(clienteRepo.existeEmail('ana@example.com')).toBe(true);
    expect(clienteRepo.existeEmail('otra@example.com')).toBe(false);
  });

  it('actualiza un cliente', () => {
    const cliente = crearCliente();
    const actualizado = clienteRepo.actualizar(cliente.id, { nombre: 'Ana María' });
    expect(actualizado?.nombre).toBe('Ana María');
  });

  it('eliminar borra un cliente', () => {
    const cliente = crearCliente();
    expect(clienteRepo.eliminar(cliente.id)).toBe(true);
    expect(clienteRepo.porId(cliente.id)).toBeNull();
  });
});

describe('SqlitePedidoRepository', () => {
  it('crear inserta el pedido y descuenta el stock', () => {
    const cliente = crearCliente();
    const producto = crearProducto({ precio: 25, stock: 10 });

    const pedido = pedidoRepo.crear({
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: 4,
      precio_unitario: 25,
    });

    expect(pedido.id).toBeGreaterThan(0);
    expect(pedido.cantidad).toBe(4);
    // Verifica el descuento de stock en la base real.
    expect(productoRepo.porId(producto.id)?.stock).toBe(6);
  });

  it('la creación es atómica: sin stock no se inserta el pedido', () => {
    const cliente = crearCliente();
    const producto = crearProducto({ stock: 2 });

    expect(() =>
      pedidoRepo.crear({
        cliente_id: cliente.id,
        producto_id: producto.id,
        cantidad: 5,
        precio_unitario: 10,
      }),
    ).toThrow(InsufficientStockError);

    // Ni el pedido se guardó ni el stock cambió.
    expect(pedidoRepo.listar()).toHaveLength(0);
    expect(productoRepo.porId(producto.id)?.stock).toBe(2);
  });

  it('la transacción revierte si el stock se agota a mitad', () => {
    const cliente = crearCliente();
    const producto = crearProducto({ stock: 10 });

    pedidoRepo.crear({
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: 10,
      precio_unitario: 10,
    });
    expect(productoRepo.porId(producto.id)?.stock).toBe(0);

    // Este segundo pedido falla y no debe dejar rastro.
    expect(() =>
      pedidoRepo.crear({
        cliente_id: cliente.id,
        producto_id: producto.id,
        cantidad: 1,
        precio_unitario: 10,
      }),
    ).toThrow(InsufficientStockError);

    expect(pedidoRepo.listar()).toHaveLength(1);
    expect(productoRepo.porId(producto.id)?.stock).toBe(0);
  });

  it('listarPorCliente filtra correctamente', () => {
    const c1 = crearCliente('c1@example.com');
    const c2 = crearCliente('c2@example.com');
    const producto = crearProducto({ stock: 100 });

    pedidoRepo.crear({
      cliente_id: c1.id,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 1,
    });
    pedidoRepo.crear({
      cliente_id: c2.id,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 1,
    });

    expect(pedidoRepo.listarPorCliente(c1.id)).toHaveLength(1);
    expect(pedidoRepo.listarPorCliente(c2.id)).toHaveLength(1);
  });

  it('el precio unitario se guarda con precisión decimal', () => {
    const cliente = crearCliente();
    const producto = crearProducto({ stock: 10 });

    const pedido = pedidoRepo.crear({
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 19.99,
    });

    expect(pedido.precio_unitario).toBe(19.99);
  });
});

describe('crearAplicacion (composición raíz)', () => {
  let app: Aplicacion;

  beforeEach(() => {
    app = crearAplicacion(createDatabaseConfig({ filename: ':memory:' }));
  });

  afterEach(() => {
    app.cerrar();
  });

  it('expone los tres servicios funcionando de punta a punta', () => {
    const producto = app.productos.crear({ nombre: 'Teclado', precio: 50, stock: 5 });
    const cliente = app.clientes.crear({ nombre: 'Ana', email: 'ana@example.com' });
    const pedido = app.pedidos.crear({
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: 2,
    });

    expect(pedido.total).toBe(100);
    expect(app.productos.porId(producto.id).stock).toBe(3);
    expect(app.pedidos.totalGeneral()).toBe(100);
  });
});
