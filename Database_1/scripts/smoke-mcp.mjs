import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

/**
 * Prueba de humo: arranca el servidor MCP compilado (dist/mcp/index.js) por
 * stdio, lista las tools y ejecuta una llamada real de punta a punta.
 *
 * Uso: `pnpm build && node scripts/smoke-mcp.mjs`
 */

const transporte = new StdioClientTransport({
  command: 'node',
  args: ['dist/mcp/index.js'],
  cwd: new URL('..', import.meta.url).pathname,
});

const client = new Client({ name: 'smoke-test', version: '1.0.0' });

await client.connect(transporte);

const info = await client.getServerVersion();
console.log('Conectado a:', info?.name, 'v' + info?.version);

const { tools } = await client.listTools();
console.log('Tools registradas (' + tools.length + '):');
for (const tool of tools.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log('  -', tool.name);
}

// Llamada real: crear un producto y luego consultarlo.
const creado = await client.callTool({
  name: 'crear_producto',
  arguments: { nombre: 'Producto de humo', precio: 9.99, stock: 5 },
});
console.log('\ncrear_producto => isError:', creado.isError ?? false);
console.log(
  'respuesta:',
  creado.content?.[0]?.type === 'text' ? creado.content[0].text : '(sin texto)',
);

const total = await client.callTool({ name: 'total_general', arguments: {} });
console.log(
  '\ntotal_general =>',
  total.content?.[0]?.type === 'text' ? total.content[0].text : '(sin texto)',
);

await client.close();
console.log('\n✅ Prueba de humo superada.');
process.exit(0);
