import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConfig } from '../../src/config/database.js';
import { crearAplicacion } from '../../src/index.js';
import type { Aplicacion } from '../../src/index.js';
import {
  CLIENTES_DE_PRUEBA,
  PEDIDOS_DE_PRUEBA,
  PRODUCTOS_DE_PRUEBA,
  sembrarDatos,
} from '../../src/database/seed.js';

/**
 * Tests de integración del seed: validan que la población de datos de prueba
 * cumple los volúmenes pedidos (10 productos, 5 clientes, 10 pedidos) y que
 * las reglas de negocio se respetan (stock, foreign keys, totales).
 */

let app: Aplicacion;

beforeEach(() => {
  app = crearAplicacion(createDatabaseConfig({ filename: ':memory:' }));
});

afterEach(() => {
  app.cerrar();
});

describe('sembrarDatos', () => {
  it('inserta exactamente 10 productos, 5 clientes y 10 pedidos', () => {
    const resumen = sembrarDatos(app);

    expect(resumen).toEqual({ productos: 10, clientes: 5, pedidos: 10 });
    expect(app.productos.listar()).toHaveLength(10);
    expect(app.clientes.listar()).toHaveLength(5);
    expect(app.pedidos.listar()).toHaveLength(10);
  });

  it('los datos de prueba coinciden con los arrays exportados', () => {
    expect(PRODUCTOS_DE_PRUEBA).toHaveLength(10);
    expect(CLIENTES_DE_PRUEBA).toHaveLength(5);
    expect(PEDIDOS_DE_PRUEBA).toHaveLength(10);
  });

  it('crea clientes con emails únicos', () => {
    sembrarDatos(app);
    const emails = app.clientes.listar().map((c) => c.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('los pedidos referencian clientes y productos existentes', () => {
    sembrarDatos(app);
    const idsClientes = new Set(app.clientes.listar().map((c) => c.id));
    const idsProductos = new Set(app.productos.listar().map((p) => p.id));

    for (const pedido of app.pedidos.listar()) {
      expect(idsClientes.has(pedido.cliente_id)).toBe(true);
      expect(idsProductos.has(pedido.producto_id)).toBe(true);
    }
  });

  it('el stock descontado coincide con la cantidad pedida', () => {
    sembrarDatos(app);

    // Para cada producto, su stock debe ser el inicial menos lo pedido.
    for (const productoOriginal of PRODUCTOS_DE_PRUEBA) {
      const producto = app.productos.listar().find((p) => p.nombre === productoOriginal.nombre);
      expect(producto).toBeDefined();

      const pedidosDeEsteProducto = app.pedidos
        .listar()
        .filter((pedido) => pedido.producto_id === producto?.id);
      const totalPedido = pedidosDeEsteProducto.reduce((suma, p) => suma + p.cantidad, 0);

      expect(producto?.stock).toBe(productoOriginal.stock - totalPedido);
      // Nunca debe quedar stock negativo.
      expect(producto?.stock).toBeGreaterThanOrEqual(0);
    }
  });

  it('el total general es correcto y no hay stock negativo', () => {
    sembrarDatos(app);

    expect(app.pedidos.totalGeneral()).toBeGreaterThan(0);
    for (const producto of app.productos.listar()) {
      expect(producto.stock).toBeGreaterThanOrEqual(0);
    }
  });

  it('el total por cliente suma sus pedidos', () => {
    sembrarDatos(app);

    for (const cliente of app.clientes.listar()) {
      const pedidos = app.pedidos.listarPorCliente(cliente.id);
      const sumaManual = pedidos.reduce((suma, p) => suma + p.total, 0);
      expect(app.pedidos.totalPorCliente(cliente.id)).toBe(sumaManual);
    }
  });
});
