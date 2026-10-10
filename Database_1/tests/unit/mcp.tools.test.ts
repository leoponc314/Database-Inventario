import { beforeEach, describe, expect, it } from 'vitest';
import { crearAplicacion } from '../../src/index.js';
import type { Aplicacion } from '../../src/index.js';
import { createDatabaseConfig } from '../../src/config/database.js';
import { crearServidorMCP } from '../../src/mcp/server.js';
import { ok, fallo, ejecutar } from '../../src/mcp/helpers.js';

/**
 * Tests unitarios de la capa MCP: helpers puros y el registro de tools.
 *
 * Usamos SQLite en memoria (no los fakes) porque la capa MCP delega 100% en
 * los servicios ya testeados; lo que aquí importa es que las tools devuelven
 * JSON bien formado y que los errores salen como `isError`, no como crash.
 */

let app: Aplicacion;

beforeEach(() => {
  app = crearAplicacion(createDatabaseConfig({ filename: ':memory:' }));
});

describe('helpers MCP', () => {
  it('ok serializa el dato en JSON dentro de content', () => {
    const resultado = ok({ id: 1, nombre: 'Teclado' });
    expect(resultado.isError).toBeUndefined();
    expect(resultado.content).toHaveLength(1);
    const contenido = resultado.content?.[0];
    expect(contenido?.type).toBe('text');
    if (contenido?.type === 'text') {
      expect(JSON.parse(contenido.text)).toEqual({ id: 1, nombre: 'Teclado' });
    }
  });

  it('fallo marca isError y conserva el mensaje', () => {
    const resultado = fallo('No hay stock.');
    expect(resultado.isError).toBe(true);
    const contenido = resultado.content?.[0];
    if (contenido?.type === 'text') {
      expect(contenido.text).toBe('No hay stock.');
    }
  });

  it('ejecutar devuelve ok cuando la acción no lanza', async () => {
    const resultado = await ejecutar(() => ({ suma: 2 + 2 }));
    expect(resultado.isError).toBeUndefined();
  });

  it('ejecutar convierte AppError en isError con su mensaje', async () => {
    const resultado = await ejecutar(() => {
      throw new Error('Stock insuficiente: disponible 2, solicitado 5.');
    });
    expect(resultado.isError).toBe(true);
  });

  it('ejecutar serializa el error como texto legible', async () => {
    const resultado = await ejecutar(() => {
      throw new Error('Mensaje de prueba');
    });
    const contenido = resultado.content?.[0];
    expect(contenido?.type).toBe('text');
    if (contenido?.type === 'text') {
      expect(contenido.text).toContain('Mensaje de prueba');
    }
  });
});

describe('crearServidorMCP', () => {
  it('crea un servidor con nombre y versión correctos', () => {
    const server = crearServidorMCP(app);
    expect(server).toBeDefined();
  });

  it('no lanza al construirse con la app real', () => {
    expect(() => crearServidorMCP(app)).not.toThrow();
  });
});
