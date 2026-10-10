import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { PedidoService } from '../../domain/pedido/service.js';
import { ejecutar } from '../helpers.js';

/**
 * Tools MCP del dominio `pedido`.
 *
 * La más relevante es `crear_pedido`: valida cliente/producto/stock y delega en
 * el repositorio, que ejecuta la creación y el descuento de stock dentro de una
 * transacción. Si no hay stock, se devuelve `isError` y no se persiste nada.
 */
export function registrarToolsPedido(server: McpServer, pedidos: PedidoService): void {
  server.registerTool(
    'crear_pedido',
    {
      title: 'Crear pedido',
      description:
        'Crea un pedido validando que el cliente y el producto existen, que el producto está activo y que hay stock suficiente. El pedido y el descuento de stock se aplican en una única transacción. Si el precio unitario se omite, se usa el precio vigente del producto.',
      inputSchema: z.object({
        cliente_id: z.number().int().positive().describe('Id del cliente que realiza el pedido.'),
        producto_id: z.number().int().positive().describe('Id del producto pedido.'),
        cantidad: z.number().int().positive().describe('Unidades pedidas, entero mayor que 0.'),
        precio_unitario: z
          .number()
          .min(0)
          .optional()
          .describe('Precio unitario opcional. Si se omite se usa el del producto.'),
      }),
    },
    async (entrada) =>
      ejecutar(() =>
        pedidos.crear({
          cliente_id: entrada.cliente_id,
          producto_id: entrada.producto_id,
          cantidad: entrada.cantidad,
          ...(entrada.precio_unitario !== undefined
            ? { precio_unitario: entrada.precio_unitario }
            : {}),
        }),
      ),
  );

  server.registerTool(
    'listar_pedidos',
    {
      title: 'Listar pedidos',
      description: 'Devuelve todos los pedidos con su importe total precalculado.',
      inputSchema: z.object({}),
    },
    async () => ejecutar(() => pedidos.listar()),
  );

  server.registerTool(
    'obtener_pedido',
    {
      title: 'Obtener pedido',
      description: 'Devuelve un pedido por su id con su total. Devuelve error si no existe.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id numérico del pedido.'),
      }),
    },
    async ({ id }) => ejecutar(() => pedidos.porId(id)),
  );

  server.registerTool(
    'listar_pedidos_por_cliente',
    {
      title: 'Listar pedidos por cliente',
      description:
        'Devuelve los pedidos de un cliente con su total. Devuelve lista vacía si no tiene.',
      inputSchema: z.object({
        cliente_id: z.number().int().positive().describe('Id del cliente.'),
      }),
    },
    async ({ cliente_id }) => ejecutar(() => pedidos.listarPorCliente(cliente_id)),
  );

  server.registerTool(
    'total_pedidos_cliente',
    {
      title: 'Total de pedidos de un cliente',
      description:
        'Suma el importe total de todos los pedidos de un cliente. Devuelve 0 si no tiene.',
      inputSchema: z.object({
        cliente_id: z.number().int().positive().describe('Id del cliente.'),
      }),
    },
    async ({ cliente_id }) =>
      ejecutar(() => ({ cliente_id, total: pedidos.totalPorCliente(cliente_id) })),
  );

  server.registerTool(
    'total_general',
    {
      title: 'Total general',
      description:
        'Suma el importe total de todos los pedidos del inventario. Devuelve 0 si no hay.',
      inputSchema: z.object({}),
    },
    async () => ejecutar(() => ({ total: pedidos.totalGeneral() })),
  );

  server.registerTool(
    'eliminar_pedido',
    {
      title: 'Eliminar pedido',
      description: 'Elimina un pedido por su id. Devuelve error si no existe.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id del pedido a eliminar.'),
      }),
    },
    async ({ id }) => ejecutar(() => ({ eliminado: pedidos.eliminar(id), id })),
  );
}
