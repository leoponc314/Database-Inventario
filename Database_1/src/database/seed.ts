import { pathToFileURL } from 'node:url';
import { createDatabaseConfig } from '../config/database.js';
import { crearAplicacion } from '../index.js';
import type { Aplicacion } from '../index.js';

/**
 * Datos de prueba y función de seeding.
 *
 * Este módulo es IMPORTABLE (lo usan los tests) y también ejecutable
 * directamente con `pnpm seed`. El script solo se lanza si el módulo es la
 * entrada principal, para no arrancar la app al importarlo en un test.
 */

export const PRODUCTOS_DE_PRUEBA = [
  { nombre: 'Portátil ThinkPad X1', descripcion: '14", i7, 16GB RAM', precio: 1299.99, stock: 25 },
  { nombre: 'Ratón inalámbrico', descripcion: 'Ergonómico, USB-C', precio: 24.9, stock: 140 },
  { nombre: 'Teclado mecánico', descripcion: 'Switches rojos, RGB', precio: 89.5, stock: 60 },
  { nombre: 'Monitor 27" QHD', descripcion: 'IPS, 75Hz', precio: 249.0, stock: 35 },
  { nombre: 'Silla ergonómica', descripcion: 'Soporte lumbar', precio: 179.99, stock: 18 },
  { nombre: 'Webcam Full HD', descripcion: '1080p con micrófono', precio: 59.9, stock: 80 },
  { nombre: 'Disco SSD 1TB', descripcion: 'NVMe, lectura 3500MB/s', precio: 99.9, stock: 120 },
  { nombre: 'Router Wi-Fi 6', descripcion: 'Doble banda, AX1800', precio: 129.0, stock: 45 },
  {
    nombre: 'Altavoz Bluetooth',
    descripcion: 'Portátil, resistente al agua',
    precio: 45.5,
    stock: 70,
  },
  { nombre: 'Cargador USB-C 65W', descripcion: 'GaN, compacto', precio: 34.9, stock: 200 },
] as const;

export const CLIENTES_DE_PRUEBA = [
  { nombre: 'Ana García', email: 'ana.garcia@example.com', telefono: '+34 600 111 222' },
  { nombre: 'Luis Martínez', email: 'luis.martinez@example.com', telefono: '+34 600 333 444' },
  { nombre: 'Carmen López', email: 'carmen.lopez@example.com', telefono: null },
  { nombre: 'Javier Sánchez', email: 'javier.sanchez@example.com', telefono: '+34 600 555 666' },
  { nombre: 'María Fernández', email: 'maria.fernandez@example.com', telefono: '+34 600 777 888' },
] as const;

/** Pedidos de prueba: índices 0-based sobre los arrays de arriba. */
export const PEDIDOS_DE_PRUEBA = [
  { cliente: 0, producto: 0, cantidad: 1 },
  { cliente: 1, producto: 1, cantidad: 3 },
  { cliente: 2, producto: 2, cantidad: 1 },
  { cliente: 3, producto: 3, cantidad: 2 },
  { cliente: 4, producto: 4, cantidad: 1 },
  { cliente: 0, producto: 6, cantidad: 2 },
  { cliente: 1, producto: 9, cantidad: 4 },
  { cliente: 2, producto: 5, cantidad: 1 },
  { cliente: 3, producto: 7, cantidad: 1 },
  { cliente: 4, producto: 8, cantidad: 2 },
] as const;

export interface ResumenSeed {
  readonly productos: number;
  readonly clientes: number;
  readonly pedidos: number;
}

/**
 * Inserta los datos de prueba en la base de datos.
 * Devuelve un resumen de lo insertado.
 */
export function sembrarDatos(app: Aplicacion): ResumenSeed {
  const productos = PRODUCTOS_DE_PRUEBA.map((producto) => app.productos.crear({ ...producto }));
  const clientes = CLIENTES_DE_PRUEBA.map((cliente) => app.clientes.crear({ ...cliente }));

  const pedidos = PEDIDOS_DE_PRUEBA.map((pedido) => {
    const cliente = clientes[pedido.cliente];
    const producto = productos[pedido.producto];
    if (!cliente || !producto) {
      throw new Error('Datos de prueba inconsistentes: cliente o producto fuera de rango.');
    }
    return app.pedidos.crear({
      cliente_id: cliente.id,
      producto_id: producto.id,
      cantidad: pedido.cantidad,
    });
  });

  return {
    productos: productos.length,
    clientes: clientes.length,
    pedidos: pedidos.length,
  };
}

/** Punto de entrada CLI (`pnpm seed`). */
function main(): void {
  const app = crearAplicacion(createDatabaseConfig());
  try {
    const resumen = sembrarDatos(app);
    console.log('Seed completado correctamente.');
    console.table(resumen);
  } catch (error) {
    console.error('Error durante el seed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    app.cerrar();
  }
}

// Solo se ejecuta si llamamos `node dist/database/seed.js` o `tsx src/database/seed.ts`.
const esEntradaPrincipal =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEntradaPrincipal) {
  main();
}
