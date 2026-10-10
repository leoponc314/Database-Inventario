import { McpServer } from '@modelcontextprotocol/server';
import type { Aplicacion } from '../index.js';
import { registrarToolsProducto } from './tools/producto.tools.js';
import { registrarToolsCliente } from './tools/cliente.tools.js';
import { registrarToolsPedido } from './tools/pedido.tools.js';

export const NOMBRE_SERVIDOR = 'inventario';
export const VERSION_SERVIDOR = '1.0.0';

/**
 * Crea el servidor MCP con todas las tools del inventario registradas.
 *
 * Recibe la `Aplicacion` por parámetro (dependency injection), lo que permite
 * testear el servidor con servicios falsos o con SQLite en memoria sin tocar
 * el transporte.
 */
export function crearServidorMCP(app: Aplicacion): McpServer {
  const server = new McpServer({
    name: NOMBRE_SERVIDOR,
    version: VERSION_SERVIDOR,
  });

  registrarToolsProducto(server, app.productos);
  registrarToolsCliente(server, app.clientes);
  registrarToolsPedido(server, app.pedidos);

  return server;
}
