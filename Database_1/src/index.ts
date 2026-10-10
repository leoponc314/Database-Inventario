import { pathToFileURL } from 'node:url';
import { createDatabaseConfig } from './config/database.js';
import { migrar } from './database/migrations.js';
import { openDatabase, closeDatabase } from './database/connection.js';
import { ProductoService } from './domain/producto/service.js';
import { ClienteService } from './domain/cliente/service.js';
import { PedidoService } from './domain/pedido/service.js';
import { SqliteProductoRepository } from './repositories/sqlite/producto.repository.js';
import { SqliteClienteRepository } from './repositories/sqlite/cliente.repository.js';
import { SqlitePedidoRepository } from './repositories/sqlite/pedido.repository.js';
import type { DatabaseConfig } from './config/database.js';

/**
 * Composición raíz (composition root).
 *
 * Es el ÚNICO punto que conoce las implementaciones concretas de SQLite.
 * Los consumidores reciben servicios tipados y nada más.
 */

export interface Aplicacion {
  readonly productos: ProductoService;
  readonly clientes: ClienteService;
  readonly pedidos: PedidoService;
  /** Cierra la base de datos. */
  cerrar(): void;
}

/** Crea la aplicación completa a partir de una configuración. Ejecuta las migraciones. */
export function crearAplicacion(config: DatabaseConfig = createDatabaseConfig()): Aplicacion {
  const db = openDatabase(config);
  migrar(db, config.migrationsDir);

  const productoRepository = new SqliteProductoRepository(db);
  const clienteRepository = new SqliteClienteRepository(db);
  const pedidoRepository = new SqlitePedidoRepository(db);

  return {
    productos: new ProductoService(productoRepository),
    clientes: new ClienteService(clienteRepository),
    pedidos: new PedidoService(pedidoRepository, clienteRepository, productoRepository),
    cerrar: () => closeDatabase(db),
  };
}

// Re-exporta los tipos y servicios públicos de la API.
export { ProductoService } from './domain/producto/service.js';
export { ClienteService } from './domain/cliente/service.js';
export { PedidoService } from './domain/pedido/service.js';
export { calcularTotalPedido } from './domain/pedido/totales.js';
export { SqliteProductoRepository } from './repositories/sqlite/producto.repository.js';
export { SqliteClienteRepository } from './repositories/sqlite/cliente.repository.js';
export { SqlitePedidoRepository } from './repositories/sqlite/pedido.repository.js';
export { createDatabaseConfig } from './config/database.js';
export { openDatabase, closeDatabase } from './database/connection.js';
export { migrar } from './database/migrations.js';
export * from './domain/producto/types.js';
export * from './domain/cliente/types.js';
export * from './domain/pedido/types.js';
export * from './utils/errors.js';

/** Demo ligera para `pnpm dev`: cuenta registros y calcula un total. */
function demo(): void {
  const app = crearAplicacion();
  try {
    const productos = app.productos.listar();
    const clientes = app.clientes.listar();
    const pedidos = app.pedidos.listar();
    console.log(`Productos: ${productos.length}`);
    console.log(`Clientes:  ${clientes.length}`);
    console.log(`Pedidos:   ${pedidos.length}`);
    console.log(`Total:     ${app.pedidos.totalGeneral().toFixed(2)} €`);
  } finally {
    app.cerrar();
  }
}

// Solo se ejecuta la demo cuando el módulo es la entrada principal (`pnpm dev`).
const esEntradaPrincipal =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEntradaPrincipal) {
  demo();
}
