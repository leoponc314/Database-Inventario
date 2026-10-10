import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ProductoService } from '../../domain/producto/service.js';
import { ejecutar } from '../helpers.js';

/**
 * Tools MCP del dominio `producto`.
 *
 * Cada tool es una capa fina: valida la forma de entrada con zod y delega en
 * `ProductoService`. No hay lógica de negocio aquí.
 */
export function registrarToolsProducto(server: McpServer, productos: ProductoService): void {
  server.registerTool(
    'listar_productos',
    {
      title: 'Listar productos',
      description:
        'Devuelve todos los productos del inventario. Con soloActivos=true omite los dados de baja.',
      inputSchema: z.object({
        soloActivos: z
          .boolean()
          .optional()
          .describe('Si es true, solo devuelve productos activos. Por defecto false.'),
      }),
    },
    async ({ soloActivos }) =>
      ejecutar(() => productos.listar({ soloActivos: soloActivos ?? false })),
  );

  server.registerTool(
    'obtener_producto',
    {
      title: 'Obtener producto',
      description: 'Devuelve un producto por su id. Devuelve error si no existe.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id numérico del producto.'),
      }),
    },
    async ({ id }) => ejecutar(() => productos.porId(id)),
  );

  server.registerTool(
    'buscar_productos_por_nombre',
    {
      title: 'Buscar productos por nombre',
      description:
        'Busca productos cuyo nombre contenga el texto indicado, sin distinguir mayúsculas. Devuelve lista (posiblemente vacía).',
      inputSchema: z.object({
        nombre: z.string().min(1).describe('Texto parcial a buscar en el nombre.'),
      }),
    },
    async ({ nombre }) => ejecutar(() => productos.buscarPorNombre(nombre)),
  );

  server.registerTool(
    'crear_producto',
    {
      title: 'Crear producto',
      description:
        'Crea un producto nuevo. Valida nombre (obligatorio), precio (>=0) y stock (entero >=0).',
      inputSchema: z.object({
        nombre: z.string().min(1).describe('Nombre del producto.'),
        descripcion: z
          .string()
          .nullable()
          .optional()
          .describe('Descripción opcional del producto.'),
        precio: z.number().min(0).describe('Precio unitario, número mayor o igual a 0.'),
        stock: z
          .number()
          .int()
          .min(0)
          .describe('Unidades en stock, número entero mayor o igual a 0.'),
        activo: z
          .boolean()
          .optional()
          .describe('Si es false el producto queda inactivo. Por defecto true.'),
      }),
    },
    async (entrada) =>
      ejecutar(() =>
        productos.crear({
          nombre: entrada.nombre,
          descripcion: entrada.descripcion ?? null,
          precio: entrada.precio,
          stock: entrada.stock,
          ...(entrada.activo !== undefined ? { activo: entrada.activo } : {}),
        }),
      ),
  );

  server.registerTool(
    'actualizar_producto',
    {
      title: 'Actualizar producto',
      description:
        'Actualiza campos parciales de un producto (nombre, descripcion, precio, stock, activo). Devuelve error si el producto no existe.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id del producto a actualizar.'),
        nombre: z.string().min(1).optional(),
        descripcion: z.string().nullable().optional(),
        precio: z.number().min(0).optional(),
        stock: z.number().int().min(0).optional(),
        activo: z.boolean().optional(),
      }),
    },
    async ({ id, ...cambios }) => ejecutar(() => productos.actualizar(id, cambios)),
  );

  server.registerTool(
    'eliminar_producto',
    {
      title: 'Eliminar producto',
      description:
        'Elimina un producto por su id. Devuelve error si no existe o si tiene pedidos asociados (foreign key).',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id del producto a eliminar.'),
      }),
    },
    async ({ id }) => ejecutar(() => ({ eliminado: productos.eliminar(id), id })),
  );
}
