import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { createDatabaseConfig } from '../../src/config/database.js';
import { crearAplicacion } from '../../src/index.js';
import type { Aplicacion } from '../../src/index.js';
import { crearServidorMCP } from '../../src/mcp/server.js';

/**
 * Tests de integración del servidor MCP: conectan un CLIENTE real al servidor
 * a través de un transporte en memoria y llaman tools de punta a punta,
 * atravesando el protocolo completo (sin stdio ni procesos externos).
 */

let app: Aplicacion;
let client: Client;
let cerrarServidor: () => Promise<void>;

/** Devuelve el texto del primer contenido de una respuesta de tool. */
function textoDe(respuesta: { content?: Array<{ type: string; text?: string }> }): string {
  const contenido = respuesta.content?.[0];
  return contenido?.text ?? '';
}

/** Llama a una tool y devuelve su respuesta y el texto parseado como JSON.
 *
 * Los resultados de error (`isError: true`) llevan texto plano, no JSON, así
 * que en ese caso `datos` queda `null` y el texto se consulta con `textoDe`.
 */
async function llamar(nombre: string, args: Record<string, unknown> = {}) {
  const respuesta = await client.callTool({ name: nombre, arguments: args });
  const texto = textoDe(respuesta);
  let datos: unknown = null;
  if (!respuesta.isError && texto) {
    datos = JSON.parse(texto) as unknown;
  }
  return { respuesta, datos };
}

beforeEach(async () => {
  app = crearAplicacion(createDatabaseConfig({ filename: ':memory:' }));

  const server = crearServidorMCP(app);
  const [clienteTransporte, servidorTransporte] = InMemoryTransport.createLinkedPair();

  client = new Client({ name: 'test-client', version: '1.0.0' });

  await Promise.all([server.connect(servidorTransporte), client.connect(clienteTransporte)]);

  cerrarServidor = async () => {
    await client.close();
    app.cerrar();
  };
});

afterEach(async () => {
  await cerrarServidor();
});

describe('handshake y catálogo', () => {
  it('el cliente se conecta al servidor', async () => {
    const info = await client.getServerVersion();
    expect(info?.name).toBe('inventario');
    expect(info?.version).toBe('1.0.0');
  });

  it('lista las 19 tools esperadas', async () => {
    const { tools } = await client.listTools();
    const nombres = tools.map((t) => t.name).sort();

    expect(nombres).toEqual(
      [
        'actualizar_cliente',
        'actualizar_producto',
        'buscar_cliente_por_email',
        'buscar_productos_por_nombre',
        'crear_cliente',
        'crear_pedido',
        'crear_producto',
        'eliminar_cliente',
        'eliminar_producto',
        'eliminar_pedido',
        'listar_clientes',
        'listar_pedidos',
        'listar_pedidos_por_cliente',
        'listar_productos',
        'obtener_cliente',
        'obtener_producto',
        'obtener_pedido',
        'total_general',
        'total_pedidos_cliente',
      ].sort(),
    );
  });

  it('cada tool expone descripción y esquema de entrada', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description, `tool ${tool.name} sin descripción`).toBeTruthy();
      expect(tool.inputSchema, `tool ${tool.name} sin esquema`).toBeTruthy();
    }
  });
});

describe('tools de producto', () => {
  it('crear_producto devuelve el producto creado', async () => {
    const { respuesta, datos } = await llamar('crear_producto', {
      nombre: 'Teclado mecánico',
      precio: 89.5,
      stock: 10,
    });

    expect(respuesta.isError).toBeFalsy();
    expect(datos).toMatchObject({ nombre: 'Teclado mecánico', precio: 89.5, stock: 10 });
  });

  it('crear_producto con nombre vacío devuelve isError (no tumba el servidor)', async () => {
    const { respuesta } = await llamar('crear_producto', {
      nombre: '   ',
      precio: 10,
      stock: 1,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toMatch(/nombre del producto es obligatorio/i);
  });

  it('buscar_productos_por_nombre encuentra por texto parcial', async () => {
    await llamar('crear_producto', { nombre: 'Teclado Mecánico', precio: 50, stock: 3 });
    await llamar('crear_producto', { nombre: 'Ratón', precio: 20, stock: 5 });

    const { datos } = await llamar('buscar_productos_por_nombre', { nombre: 'teclado' });
    expect(datos).toHaveLength(1);
  });

  it('obtener_producto devuelve isError si no existe', async () => {
    const { respuesta } = await llamar('obtener_producto', { id: 9999 });
    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toMatch(/no encontrado/i);
  });

  it('listar_productos devuelve lista vacía al inicio', async () => {
    const { datos } = await llamar('listar_productos');
    expect(datos).toEqual([]);
  });
});

describe('tools de cliente', () => {
  it('crear_cliente normaliza email a minúsculas', async () => {
    const { datos } = await llamar('crear_cliente', {
      nombre: 'Ana García',
      email: 'ANA.Garcia@Example.COM',
    });
    expect(datos).toMatchObject({ email: 'ana.garcia@example.com' });
  });

  it('crear_cliente con email duplicado devuelve ConflictError como isError', async () => {
    await llamar('crear_cliente', { nombre: 'Ana', email: 'ana@example.com' });
    const { respuesta } = await llamar('crear_cliente', {
      nombre: 'Otra',
      email: 'ana@example.com',
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toMatch(/ya existe un cliente/i);
  });

  it('buscar_cliente_por_email es case-insensitive', async () => {
    await llamar('crear_cliente', { nombre: 'Ana', email: 'ana@example.com' });
    const { datos } = await llamar('buscar_cliente_por_email', {
      email: 'ANA@EXAMPLE.COM',
    });
    expect(datos).toMatchObject({ nombre: 'Ana' });
  });
});

describe('tools de pedido (transacción + stock)', () => {
  it('crear_pedido descuenta el stock y devuelve el total', async () => {
    const producto = (
      await llamar('crear_producto', {
        nombre: 'SSD',
        precio: 100,
        stock: 10,
      })
    ).datos as { id: number };
    const cliente = (
      await llamar('crear_cliente', {
        nombre: 'Ana',
        email: 'ana@example.com',
      })
    ).datos as { id: number };

    const { respuesta, datos } = await llamar('crear_pedido', {
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: 3,
    });

    expect(respuesta.isError).toBeFalsy();
    expect(datos).toMatchObject({ cantidad: 3, total: 300 });

    // El stock quedó descontado en la BD.
    const trasVerificar = (await llamar('obtener_producto', { id: producto.id })).datos as {
      stock: number;
    };
    expect(trasVerificar.stock).toBe(7);
  });

  it('crear_pedido con stock insuficiente devuelve isError y NO crea el pedido', async () => {
    const producto = (
      await llamar('crear_producto', {
        nombre: 'Portátil',
        precio: 1000,
        stock: 2,
      })
    ).datos as { id: number };
    const cliente = (
      await llamar('crear_cliente', {
        nombre: 'Ana',
        email: 'ana@example.com',
      })
    ).datos as { id: number };

    const { respuesta } = await llamar('crear_pedido', {
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: 5,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toMatch(/stock insuficiente/i);

    // Ni el pedido se creó ni el stock cambió (transacción revertida).
    const pedidos = (await llamar('listar_pedidos')).datos as unknown[];
    expect(pedidos).toHaveLength(0);
    const trasVerificar = (await llamar('obtener_producto', { id: producto.id })).datos as {
      stock: number;
    };
    expect(trasVerificar.stock).toBe(2);
  });

  it('crear_pedido con cliente inexistente devuelve isError', async () => {
    const producto = (
      await llamar('crear_producto', {
        nombre: 'Ratón',
        precio: 10,
        stock: 5,
      })
    ).datos as { id: number };

    const { respuesta } = await llamar('crear_pedido', {
      cliente_id: 9999,
      producto_id: producto.id,
      cantidad: 1,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toMatch(/cliente .* no encontrado/i);
  });

  it('crear_pedido con producto inexistente devuelve isError', async () => {
    const cliente = (
      await llamar('crear_cliente', {
        nombre: 'Ana',
        email: 'ana@example.com',
      })
    ).datos as { id: number };

    const { respuesta } = await llamar('crear_pedido', {
      cliente_id: cliente.id,
      producto_id: 9999,
      cantidad: 1,
    });

    expect(respuesta.isError).toBe(true);
    expect(textoDe(respuesta)).toMatch(/producto .* no encontrado/i);
  });

  it('total_general devuelve la suma de todos los pedidos', async () => {
    const producto = (
      await llamar('crear_producto', {
        nombre: 'SSD',
        precio: 50,
        stock: 10,
      })
    ).datos as { id: number };
    const cliente = (
      await llamar('crear_cliente', {
        nombre: 'Ana',
        email: 'ana@example.com',
      })
    ).datos as { id: number };

    await llamar('crear_pedido', { cliente_id: cliente.id, producto_id: producto.id, cantidad: 2 });
    await llamar('crear_pedido', { cliente_id: cliente.id, producto_id: producto.id, cantidad: 1 });

    const { datos } = await llamar('total_general');
    expect(datos).toEqual({ total: 150 });
  });

  it('total_pedidos_cliente suma solo los de ese cliente', async () => {
    const producto = (
      await llamar('crear_producto', {
        nombre: 'Cable',
        precio: 10,
        stock: 100,
      })
    ).datos as { id: number };
    const ana = (
      await llamar('crear_cliente', {
        nombre: 'Ana',
        email: 'ana@example.com',
      })
    ).datos as { id: number };
    const luis = (
      await llamar('crear_cliente', {
        nombre: 'Luis',
        email: 'luis@example.com',
      })
    ).datos as { id: number };

    await llamar('crear_pedido', { cliente_id: ana.id, producto_id: producto.id, cantidad: 2 });
    await llamar('crear_pedido', { cliente_id: luis.id, producto_id: producto.id, cantidad: 5 });

    const { datos } = await llamar('total_pedidos_cliente', { cliente_id: ana.id });
    expect(datos).toEqual({ cliente_id: ana.id, total: 20 });
  });
});

describe('robustez del servidor', () => {
  it('una validación fallida no impide usar el servidor después', async () => {
    // 1) Falla deliberada.
    const falla = await llamar('crear_producto', { nombre: '', precio: 1, stock: 1 });
    expect(falla.respuesta.isError).toBe(true);

    // 2) El servidor sigue vivo y atiende la siguiente petición.
    const okPosterior = await llamar('crear_producto', {
      nombre: 'Válido',
      precio: 10,
      stock: 1,
    });
    expect(okPosterior.respuesta.isError).toBeFalsy();
    expect(okPosterior.datos).toMatchObject({ nombre: 'Válido' });
  });
});
