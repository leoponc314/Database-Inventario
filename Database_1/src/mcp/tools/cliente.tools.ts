import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ClienteService } from '../../domain/cliente/service.js';
import { ejecutar } from '../helpers.js';

/**
 * Tools MCP del dominio `cliente`.
 *
 * Capa fina sobre `ClienteService`: valida la forma de entrada con zod y
 * delega. La unicidad del email se resuelve en el servicio (lanza ConflictError).
 */
export function registrarToolsCliente(server: McpServer, clientes: ClienteService): void {
  server.registerTool(
    'listar_clientes',
    {
      title: 'Listar clientes',
      description: 'Devuelve todos los clientes registrados.',
      inputSchema: z.object({}),
    },
    async () => ejecutar(() => clientes.listar()),
  );

  server.registerTool(
    'obtener_cliente',
    {
      title: 'Obtener cliente',
      description: 'Devuelve un cliente por su id. Devuelve error si no existe.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id numérico del cliente.'),
      }),
    },
    async ({ id }) => ejecutar(() => clientes.porId(id)),
  );

  server.registerTool(
    'buscar_cliente_por_email',
    {
      title: 'Buscar cliente por email',
      description:
        'Devuelve el cliente con ese email (sin distinguir mayúsculas) o null si no existe.',
      inputSchema: z.object({
        email: z.email().describe('Email del cliente a buscar.'),
      }),
    },
    async ({ email }) => ejecutar(() => clientes.porEmail(email)),
  );

  server.registerTool(
    'crear_cliente',
    {
      title: 'Crear cliente',
      description:
        'Crea un cliente nuevo. El email es obligatorio, único y se valida su formato. Devuelve ConflictError si el email ya existe.',
      inputSchema: z.object({
        nombre: z.string().min(1).describe('Nombre completo del cliente.'),
        email: z.email().describe('Email válido y único del cliente.'),
        telefono: z
          .string()
          .nullable()
          .optional()
          .describe('Teléfono opcional. Solo dígitos y los símbolos + ( ) - .'),
      }),
    },
    async (entrada) =>
      ejecutar(() =>
        clientes.crear({
          nombre: entrada.nombre,
          email: entrada.email,
          telefono: entrada.telefono ?? null,
        }),
      ),
  );

  server.registerTool(
    'actualizar_cliente',
    {
      title: 'Actualizar cliente',
      description:
        'Actualiza campos parciales de un cliente (nombre, email, telefono). Devuelve error si no existe o si el email pertenece a otro cliente.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id del cliente a actualizar.'),
        nombre: z.string().min(1).optional(),
        email: z.email().optional(),
        telefono: z.string().nullable().optional(),
      }),
    },
    async ({ id, ...cambios }) => ejecutar(() => clientes.actualizar(id, cambios)),
  );

  server.registerTool(
    'eliminar_cliente',
    {
      title: 'Eliminar cliente',
      description:
        'Elimina un cliente por su id. Devuelve error si no existe o si tiene pedidos asociados (foreign key).',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Id del cliente a eliminar.'),
      }),
    },
    async ({ id }) => ejecutar(() => ({ eliminado: clientes.eliminar(id), id })),
  );
}
