import { beforeEach, describe, expect, it } from 'vitest';
import { ClienteService } from '../../src/domain/cliente/service.js';
import { ConflictError, NotFoundError } from '../../src/utils/errors.js';
import { FakeClienteRepository } from '../helpers/fakes.js';

describe('ClienteService', () => {
  let repository: FakeClienteRepository;
  let service: ClienteService;

  beforeEach(() => {
    repository = new FakeClienteRepository();
    service = new ClienteService(repository);
  });

  describe('crear', () => {
    it('crea un cliente válido con valores por defecto', () => {
      const cliente = service.crear({
        nombre: '  Ana   García ',
        email: '  Ana.Garcia@Example.com ',
      });

      expect(cliente.id).toBeGreaterThan(0);
      expect(cliente.nombre).toBe('Ana García');
      // El email se normaliza a minúsculas y sin espacios.
      expect(cliente.email).toBe('ana.garcia@example.com');
      expect(cliente.telefono).toBeNull();
      expect(cliente.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('acepta un teléfono válido', () => {
      const cliente = service.crear({
        nombre: 'Luis',
        email: 'luis@example.com',
        telefono: '+34 600 111 222',
      });
      expect(cliente.telefono).toBe('+34 600 111 222');
    });

    it('convierte teléfono vacío en null', () => {
      const cliente = service.crear({ nombre: 'Luis', email: 'luis@example.com', telefono: '   ' });
      expect(cliente.telefono).toBeNull();
    });

    it('rechaza nombre vacío', () => {
      expect(() => service.crear({ nombre: '   ', email: 'a@b.co' })).toThrow(
        /nombre del cliente es obligatorio/i,
      );
    });

    it('rechaza nombre demasiado largo', () => {
      expect(() => service.crear({ nombre: 'x'.repeat(201), email: 'a@b.co' })).toThrow(
        /no puede superar 200 caracteres/i,
      );
    });

    it.each([
      ['sin arroba', ' usuarioexample.com '],
      ['sin punto en el dominio', 'usuario@dominio'],
      ['sin parte local', '@example.com'],
      ['con espacios internos', 'usua rio@example.com'],
      ['vacío', '   '],
      ['texto no string', 123 as unknown as string],
    ])('rechaza email inválido (%s)', (_motivo, email) => {
      expect(() => service.crear({ nombre: 'Ana', email })).toThrow(/email .* no es válido/i);
    });

    it('rechaza teléfono con caracteres no permitidos', () => {
      expect(() =>
        service.crear({ nombre: 'Ana', email: 'a@b.co', telefono: 'llamar ya!!' }),
      ).toThrow(/teléfono .* solo puede contener/i);
    });

    it('rechaza teléfono demasiado largo', () => {
      expect(() =>
        service.crear({ nombre: 'Ana', email: 'a@b.co', telefono: '1'.repeat(31) }),
      ).toThrow(/teléfono .* no puede superar 30 caracteres/i);
    });

    it('rechaza email duplicado', () => {
      service.crear({ nombre: 'Ana', email: 'ana@example.com' });
      expect(() => service.crear({ nombre: 'Otra Ana', email: 'ANA@example.com' })).toThrow(
        ConflictError,
      );
      expect(() => service.crear({ nombre: 'Otra Ana', email: 'ana@example.com' })).toThrow(
        /ya existe un cliente con el email/i,
      );
    });
  });

  describe('porId', () => {
    it('devuelve el cliente existente', () => {
      const creado = repository.insertar({ nombre: 'Ana', email: 'ana@example.com' });
      expect(service.porId(creado.id).nombre).toBe('Ana');
    });

    it('lanza NotFoundError si no existe', () => {
      expect(() => service.porId(9999)).toThrow(NotFoundError);
    });
  });

  describe('porEmail', () => {
    it('encuentra por email sin distinguir mayúsculas', () => {
      repository.insertar({ nombre: 'Ana', email: 'ana@example.com' });
      expect(service.porEmail('ANA@EXAMPLE.COM')?.nombre).toBe('Ana');
    });

    it('devuelve null si no existe', () => {
      expect(service.porEmail('nadie@example.com')).toBeNull();
    });
  });

  describe('actualizar', () => {
    it('actualiza el nombre', () => {
      const creado = repository.insertar({ nombre: 'Ana', email: 'ana@example.com' });
      const actualizado = service.actualizar(creado.id, { nombre: 'Ana María' });
      expect(actualizado.nombre).toBe('Ana María');
      // El resto de campos no cambian.
      expect(actualizado.email).toBe('ana@example.com');
    });

    it('permite cambiar el teléfono a null', () => {
      const creado = repository.insertar({
        nombre: 'Ana',
        email: 'ana@example.com',
        telefono: '600111222',
      });
      expect(service.actualizar(creado.id, { telefono: null }).telefono).toBeNull();
    });

    it('lanza NotFoundError si no existe', () => {
      expect(() => service.actualizar(9999, { nombre: 'X' })).toThrow(NotFoundError);
    });

    it('rechaza actualización sin campos', () => {
      const creado = repository.insertar({});
      expect(() => service.actualizar(creado.id, {})).toThrow(/no hay campos para actualizar/i);
    });

    it('rechaza email duplicado de OTRO cliente', () => {
      const a = repository.insertar({ nombre: 'Ana', email: 'ana@example.com' });
      repository.insertar({ nombre: 'Luis', email: 'luis@example.com' });

      expect(() => service.actualizar(a.id, { email: 'luis@example.com' })).toThrow(ConflictError);
    });

    it('permite conservar el propio email al actualizar', () => {
      const a = repository.insertar({ nombre: 'Ana', email: 'ana@example.com' });
      expect(() => service.actualizar(a.id, { email: 'ana@example.com' })).not.toThrow();
    });

    it('rechaza campos no permitidos', () => {
      const creado = repository.insertar({});
      expect(() => service.actualizar(creado.id, { id: 7 } as never)).toThrow(
        /campo no permitido/i,
      );
    });
  });

  describe('eliminar', () => {
    it('elimina un cliente existente', () => {
      const creado = repository.insertar({});
      expect(() => service.eliminar(creado.id)).not.toThrow();
      expect(repository.porId(creado.id)).toBeNull();
    });

    it('lanza NotFoundError si no existe', () => {
      expect(() => service.eliminar(9999)).toThrow(NotFoundError);
    });
  });
});
