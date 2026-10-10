import { describe, expect, it, beforeEach } from 'vitest';
import { ProductoService } from '../../src/domain/producto/service.js';
import { NotFoundError, ValidationError } from '../../src/utils/errors.js';
import { FakeProductoRepository } from '../helpers/fakes.js';

describe('ProductoService', () => {
  let repository: FakeProductoRepository;
  let service: ProductoService;

  beforeEach(() => {
    repository = new FakeProductoRepository();
    service = new ProductoService(repository);
  });

  describe('crear', () => {
    it('crea un producto válido con valores por defecto', () => {
      const producto = service.crear({
        nombre: '  Teclado   mecánico  ',
        precio: 89.5,
        stock: 10,
      });

      expect(producto.id).toBeGreaterThan(0);
      // Los espacios múltiples se colapsan y se recortan.
      expect(producto.nombre).toBe('Teclado mecánico');
      expect(producto.descripcion).toBeNull();
      expect(producto.activo).toBe(true);
      expect(producto.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('acepta descripción y activo explícito', () => {
      const producto = service.crear({
        nombre: 'Ratón',
        descripcion: '  Inalámbrico   USB-C  ',
        precio: 24.9,
        stock: 5,
        activo: false,
      });

      expect(producto.descripcion).toBe('Inalámbrico USB-C');
      expect(producto.activo).toBe(false);
    });

    it('convierte descripción vacía en null', () => {
      const producto = service.crear({ nombre: 'Webcam', descripcion: '   ', precio: 1, stock: 1 });
      expect(producto.descripcion).toBeNull();
    });

    it('rechaza nombre vacío', () => {
      expect(() => service.crear({ nombre: '   ', precio: 10, stock: 1 })).toThrow(ValidationError);
    });

    it('rechaza nombre ausente', () => {
      expect(() => service.crear({ nombre: '', precio: 10, stock: 1 })).toThrow(
        /nombre del producto es obligatorio/i,
      );
    });

    it('rechaza nombre demasiado largo', () => {
      expect(() => service.crear({ nombre: 'x'.repeat(201), precio: 10, stock: 1 })).toThrow(
        /no puede superar 200 caracteres/i,
      );
    });

    it('rechaza precio negativo', () => {
      expect(() => service.crear({ nombre: 'Mochila', precio: -1, stock: 1 })).toThrow(
        /precio .* mayor o igual a 0/i,
      );
    });

    it('rechaza precio no numérico', () => {
      expect(() =>
        service.crear({ nombre: 'Mochila', precio: 'caro' as unknown as number, stock: 1 }),
      ).toThrow(ValidationError);
    });

    it('permite precio 0 (producto gratuito)', () => {
      const producto = service.crear({ nombre: 'Muestra', precio: 0, stock: 1 });
      expect(producto.precio).toBe(0);
    });

    it('rechaza stock negativo', () => {
      expect(() => service.crear({ nombre: 'Mochila', precio: 10, stock: -5 })).toThrow(
        /stock .* entero mayor o igual a 0/i,
      );
    });

    it('rechaza stock con decimales', () => {
      expect(() => service.crear({ nombre: 'Mochila', precio: 10, stock: 2.5 })).toThrow(
        /stock .* entero/i,
      );
    });

    it('permite stock 0', () => {
      const producto = service.crear({ nombre: 'Agotado', precio: 10, stock: 0 });
      expect(producto.stock).toBe(0);
    });

    it('rechaza activo no booleano', () => {
      expect(() =>
        service.crear({ nombre: 'X', precio: 1, stock: 1, activo: 'si' as unknown as boolean }),
      ).toThrow(/activo.*booleano/i);
    });
  });

  describe('porId', () => {
    it('devuelve el producto existente', () => {
      const creado = repository.insertar({ nombre: 'Monitor', precio: 200, stock: 3 });
      expect(service.porId(creado.id).nombre).toBe('Monitor');
    });

    it('lanza NotFoundError si no existe', () => {
      expect(() => service.porId(9999)).toThrow(NotFoundError);
      expect(() => service.porId(9999)).toThrow(/no encontrado/i);
    });
  });

  describe('listar', () => {
    it('filtra productos inactivos con soloActivos', () => {
      repository.insertar({ nombre: 'Activo', activo: true });
      repository.insertar({ nombre: 'Inactivo', activo: false });

      expect(service.listar()).toHaveLength(2);
      expect(service.listar({ soloActivos: true })).toHaveLength(1);
      expect(service.listar({ soloActivos: true })[0]?.nombre).toBe('Activo');
    });
  });

  describe('buscarPorNombre', () => {
    it('encuentra por nombre parcial sin distinguir mayúsculas', () => {
      repository.insertar({ nombre: 'Teclado Mecánico' });
      repository.insertar({ nombre: 'Ratón' });

      const resultados = service.buscarPorNombre('teclado');
      expect(resultados).toHaveLength(1);
      expect(resultados[0]?.nombre).toBe('Teclado Mecánico');
    });

    it('devuelve vacío si no hay coincidencias', () => {
      repository.insertar({ nombre: 'Ratón' });
      expect(service.buscarPorNombre('portátil')).toEqual([]);
    });
  });

  describe('actualizar', () => {
    it('actualiza campos parciales', () => {
      const creado = repository.insertar({ nombre: 'SSD', precio: 99, stock: 50 });
      const actualizado = service.actualizar(creado.id, { precio: 89.9, stock: 40 });

      expect(actualizado.nombre).toBe('SSD');
      expect(actualizado.precio).toBe(89.9);
      expect(actualizado.stock).toBe(40);
    });

    it('lanza NotFoundError si el producto no existe', () => {
      expect(() => service.actualizar(9999, { precio: 1 })).toThrow(NotFoundError);
    });

    it('rechaza actualización sin campos', () => {
      const creado = repository.insertar({});
      expect(() => service.actualizar(creado.id, {})).toThrow(/no hay campos para actualizar/i);
    });

    it('rechaza campos no permitidos', () => {
      const creado = repository.insertar({});
      expect(() => service.actualizar(creado.id, { id: 5 } as never)).toThrow(
        /campo no permitido/i,
      );
    });
  });

  describe('eliminar', () => {
    it('elimina un producto existente', () => {
      const creado = repository.insertar({});
      expect(() => service.eliminar(creado.id)).not.toThrow();
      expect(repository.porId(creado.id)).toBeNull();
    });

    it('lanza NotFoundError si no existe', () => {
      expect(() => service.eliminar(9999)).toThrow(NotFoundError);
    });
  });
});
