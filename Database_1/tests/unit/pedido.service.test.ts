import { beforeEach, describe, expect, it } from 'vitest';
import { PedidoService } from '../../src/domain/pedido/service.js';
import {
  calcularTotalPedido,
  conTotal,
  conTotales,
  sumarTotales,
} from '../../src/domain/pedido/totales.js';
import type { Pedido } from '../../src/domain/pedido/types.js';
import { InsufficientStockError, NotFoundError, ValidationError } from '../../src/utils/errors.js';
import {
  FakeClienteRepository,
  FakePedidoRepository,
  FakeProductoRepository,
} from '../helpers/fakes.js';

describe('totales (funciones puras)', () => {
  it('calcula cantidad × precio unitario', () => {
    expect(calcularTotalPedido(3, 10.5)).toBe(31.5);
    expect(calcularTotalPedido(1, 99.99)).toBe(99.99);
  });

  it('redondea a 2 decimales evitando errores de coma flotante', () => {
    // 0.1 + 0.2 da 0.30000000000000004 en coma flotante.
    expect(calcularTotalPedido(3, 0.1)).toBe(0.3);
    expect(calcularTotalPedido(1, 19.9)).toBe(19.9);
  });

  it('devuelve 0 cuando la cantidad es 0 o el precio es 0', () => {
    expect(calcularTotalPedido(0, 100)).toBe(0);
    expect(calcularTotalPedido(5, 0)).toBe(0);
  });

  it('sumarTotales agrega los totales', () => {
    const pedidos: Pedido[] = [
      { id: 1, cliente_id: 1, producto_id: 1, cantidad: 2, precio_unitario: 10, created_at: '' },
      { id: 2, cliente_id: 1, producto_id: 2, cantidad: 1, precio_unitario: 25.5, created_at: '' },
    ];
    expect(sumarTotales(conTotales(pedidos))).toBe(45.5);
  });

  it('conTotal añade el campo total', () => {
    const pedido: Pedido = {
      id: 1,
      cliente_id: 1,
      producto_id: 1,
      cantidad: 4,
      precio_unitario: 2.5,
      created_at: '2024-01-01T00:00:00.000Z',
    };
    expect(conTotal(pedido).total).toBe(10);
  });

  it('sumarTotales de lista vacía es 0', () => {
    expect(sumarTotales([])).toBe(0);
  });
});

describe('PedidoService', () => {
  let productos: FakeProductoRepository;
  let clientes: FakeClienteRepository;
  let pedidos: FakePedidoRepository;
  let service: PedidoService;

  beforeEach(() => {
    productos = new FakeProductoRepository();
    clientes = new FakeClienteRepository();
    pedidos = new FakePedidoRepository(productos);
    service = new PedidoService(pedidos, clientes, productos);
  });

  describe('crear', () => {
    it('crea un pedido usando el precio vigente del producto si no se indica', () => {
      const cliente = clientes.insertar({ nombre: 'Ana', email: 'ana@example.com' });
      const producto = productos.insertar({ nombre: 'SSD', precio: 99.9, stock: 10 });

      const pedido = service.crear({
        cliente_id: cliente.id,
        producto_id: producto.id,
        cantidad: 2,
      });

      expect(pedido.id).toBeGreaterThan(0);
      expect(pedido.precio_unitario).toBe(99.9);
      expect(pedido.cantidad).toBe(2);
      expect(pedido.total).toBe(199.8);
    });

    it('respeta el precio unitario explícito', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ precio: 100, stock: 10 });

      const pedido = service.crear({
        cliente_id: cliente.id,
        producto_id: producto.id,
        cantidad: 1,
        precio_unitario: 80,
      });

      expect(pedido.precio_unitario).toBe(80);
      expect(pedido.total).toBe(80);
    });

    it('descuenta el stock del producto al crear el pedido', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ nombre: 'Ratón', precio: 10, stock: 10 });

      service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 3 });

      expect(productos.porId(producto.id)?.stock).toBe(7);
    });

    it('permite agotar el stock exactamente', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ precio: 10, stock: 2 });

      service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 2 });

      expect(productos.porId(producto.id)?.stock).toBe(0);
    });

    it('rechaza el pedido si el cliente no existe', () => {
      const producto = productos.insertar({ stock: 10 });

      expect(() =>
        service.crear({ cliente_id: 9999, producto_id: producto.id, cantidad: 1 }),
      ).toThrow(NotFoundError);
      expect(() =>
        service.crear({ cliente_id: 9999, producto_id: producto.id, cantidad: 1 }),
      ).toThrow(/cliente .* no encontrado/i);
    });

    it('rechaza el pedido si el producto no existe', () => {
      const cliente = clientes.insertar({});

      expect(() =>
        service.crear({ cliente_id: cliente.id, producto_id: 9999, cantidad: 1 }),
      ).toThrow(/producto .* no encontrado/i);
    });

    it('rechaza el pedido si el producto está inactivo', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ activo: false, stock: 10 });

      expect(() =>
        service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 1 }),
      ).toThrow(/inactivo/i);
    });

    it('rechaza el pedido con stock insuficiente y NO descuenta nada', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ nombre: 'Portátil', precio: 100, stock: 2 });

      expect(() =>
        service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 5 }),
      ).toThrow(InsufficientStockError);

      // El stock no se toca y no se crea ningún pedido.
      expect(productos.porId(producto.id)?.stock).toBe(2);
      expect(pedidos.listar()).toHaveLength(0);
    });

    it('InsufficientStockError expone los detalles del stock', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ stock: 3 });

      try {
        service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 10 });
        expect.unreachable('debió lanzar InsufficientStockError');
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientStockError);
        const err = error as InsufficientStockError;
        expect(err.productoId).toBe(producto.id);
        expect(err.stockDisponible).toBe(3);
        expect(err.cantidadSolicitada).toBe(10);
        expect(err.code).toBe('INSUFFICIENT_STOCK');
      }
    });

    it('rechaza cantidad 0', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ stock: 10 });

      expect(() =>
        service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 0 }),
      ).toThrow(/cantidad .* mayor que 0/i);
    });

    it('rechaza cantidad negativa', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ stock: 10 });

      expect(() =>
        service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: -2 }),
      ).toThrow(ValidationError);
    });

    it('rechaza cantidad con decimales', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ stock: 10 });

      expect(() =>
        service.crear({ cliente_id: cliente.id, producto_id: producto.id, cantidad: 1.5 }),
      ).toThrow(/cantidad .* entero/i);
    });

    it('rechaza ids de cliente/producto no positivos', () => {
      expect(() => service.crear({ cliente_id: 0, producto_id: 1, cantidad: 1 })).toThrow(
        /id del cliente .* entero positivo/i,
      );
      expect(() => service.crear({ cliente_id: 1, producto_id: -1, cantidad: 1 })).toThrow(
        /id del producto .* entero positivo/i,
      );
    });

    it('rechaza precio unitario negativo', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ stock: 10 });

      expect(() =>
        service.crear({
          cliente_id: cliente.id,
          producto_id: producto.id,
          cantidad: 1,
          precio_unitario: -5,
        }),
      ).toThrow(/precio unitario .* mayor o igual a 0/i);
    });
  });

  describe('consulta de pedidos', () => {
    it('porId devuelve el pedido con su total', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ precio: 25, stock: 10 });
      const creado = service.crear({
        cliente_id: cliente.id,
        producto_id: producto.id,
        cantidad: 4,
      });

      expect(service.porId(creado.id).total).toBe(100);
    });

    it('porId lanza NotFoundError si no existe', () => {
      expect(() => service.porId(9999)).toThrow(NotFoundError);
    });

    it('listar devuelve todos los pedidos con total', () => {
      const cliente = clientes.insertar({});
      const p1 = productos.insertar({ precio: 10, stock: 10 });
      const p2 = productos.insertar({ precio: 20, stock: 10 });

      service.crear({ cliente_id: cliente.id, producto_id: p1.id, cantidad: 1 });
      service.crear({ cliente_id: cliente.id, producto_id: p2.id, cantidad: 2 });

      expect(service.listar()).toHaveLength(2);
    });

    it('listarPorCliente filtra por cliente', () => {
      const c1 = clientes.insertar({ email: 'c1@example.com' });
      const c2 = clientes.insertar({ email: 'c2@example.com' });
      const producto = productos.insertar({ precio: 10, stock: 100 });

      service.crear({ cliente_id: c1.id, producto_id: producto.id, cantidad: 1 });
      service.crear({ cliente_id: c2.id, producto_id: producto.id, cantidad: 1 });

      expect(service.listarPorCliente(c1.id)).toHaveLength(1);
      expect(service.listarPorCliente(c2.id)).toHaveLength(1);
    });

    it('totalPorCliente suma los totales de ese cliente', () => {
      const cliente = clientes.insertar({});
      const p1 = productos.insertar({ precio: 10, stock: 10 });
      const p2 = productos.insertar({ precio: 25, stock: 10 });

      service.crear({ cliente_id: cliente.id, producto_id: p1.id, cantidad: 2 }); // 20
      service.crear({ cliente_id: cliente.id, producto_id: p2.id, cantidad: 1 }); // 25

      expect(service.totalPorCliente(cliente.id)).toBe(45);
    });

    it('totalGeneral suma todos los pedidos', () => {
      const c1 = clientes.insertar({ email: 'c1@example.com' });
      const c2 = clientes.insertar({ email: 'c2@example.com' });
      const p1 = productos.insertar({ precio: 10, stock: 10 });
      const p2 = productos.insertar({ precio: 20, stock: 10 });

      service.crear({ cliente_id: c1.id, producto_id: p1.id, cantidad: 3 }); // 30
      service.crear({ cliente_id: c2.id, producto_id: p2.id, cantidad: 1 }); // 20

      expect(service.totalGeneral()).toBe(50);
    });

    it('totalGeneral es 0 sin pedidos', () => {
      expect(service.totalGeneral()).toBe(0);
    });
  });

  describe('eliminar', () => {
    it('elimina un pedido existente', () => {
      const cliente = clientes.insertar({});
      const producto = productos.insertar({ stock: 10 });
      const creado = service.crear({
        cliente_id: cliente.id,
        producto_id: producto.id,
        cantidad: 1,
      });

      expect(() => service.eliminar(creado.id)).not.toThrow();
      expect(service.listar()).toHaveLength(0);
    });

    it('lanza NotFoundError si no existe', () => {
      expect(() => service.eliminar(9999)).toThrow(NotFoundError);
    });
  });
});
