import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createDatabaseConfig } from '../config/database.js';
import { crearAplicacion } from '../index.js';
import { crearServidorMCP } from './server.js';

/**
 * Punto de entrada del servidor MCP (transporte stdio).
 *
 * Ejecutar con: `pnpm mcp` (tras build) o `pnpm mcp:dev` (sin build).
 *
 * ADVERTENCIA: en stdio, stdout es el canal del protocolo MCP. Cualquier
 * `console.log` aquí corrompería el stream. Por eso TODA la salida de este
 * fichero va por `console.error` (stderr).
 */

async function main(): Promise<void> {
  // Abrimos la BD y aplicamos migraciones antes de aceptar conexiones.
  const app = crearAplicacion(createDatabaseConfig());

  const server = crearServidorMCP(app);
  const transport = new StdioServerTransport();

  // Al conectar, el servidor queda a la espera de peticiones del cliente.
  await server.connect(transport);

  // Solo stderr: stdout es sagrado en stdio.
  console.error(`[inventario-mcp] Servidor conectado y listo sobre ${process.pid}.`);
  console.error(`[inventario-mcp] Tools registradas: 19.`);

  // Limpieza al terminar: cerramos la base de datos.
  const cerrar = (): void => {
    app.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((error: unknown) => {
  // Un fallo de arranque se informa por stderr; nunca por stdout.
  console.error('[inventario-mcp] Error fatal al arrancar:', error);
  process.exit(1);
});
