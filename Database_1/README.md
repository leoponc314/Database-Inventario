# Database_1

Gestión y consulta de una base de datos **SQLite local** con **Node.js +
TypeScript**, expuesta además como **servidor MCP** para que un agente de IA
(OpenCode, Claude, etc.) pueda consultarla y modificarla con tools tipadas.

El proyecto aplica separación de responsabilidades, tipado estricto,
Repository Pattern y TDD. La lógica de negocio no depende de SQLite: se testea
con fakes en memoria, y los repositorios son la única capa que conoce SQL.

## Stack

| Herramienta                  | Uso                                        |
| ---------------------------- | ------------------------------------------ |
| Node.js ≥ 20                 | Runtime                                    |
| TypeScript 5.9 (strict)      | Tipado estricto                            |
| PNPM                         | Gestor de paquetes                         |
| better-sqlite3               | Driver SQLite síncrono, con transacciones  |
| @modelcontextprotocol/server | SDK oficial de servidores MCP (v2)         |
| zod 4                        | Validación de esquemas de entrada de tools |
| Vitest                       | Tests unitarios e integración              |
| ESLint + Prettier            | Lint y formato                             |

## Arquitectura

Capas separadas, con dependencias que apuntan hacia dentro (el dominio no
conoce la infraestructura):

```text
src/
├── config/        Configuración pura (ruta del .sqlite, foreign keys, verbose)
├── database/      Conexión, migraciones SQL y seed
├── domain/        Reglas de negocio: tipos, validación y servicios
│   ├── producto/  ├── cliente/  └── pedido/
├── repositories/  Puerto (interfaz) en domain + implementación SQLite aquí
│   └── sqlite/    Único lugar donde existe SQL
├── mcp/           Servidor MCP: capa fina que delega en los servicios
│   └── tools/     Registro de tools por dominio
├── utils/         Funciones puras (errores tipados, fechas, validación)
└── index.ts       Composition root: única zona que conoce SQLite
```

**Flujo de un pedido:** el servicio valida que cliente y producto existen, que
el producto está activo y que hay stock; después delega en el repositorio, que
crea el pedido y descuenta el stock **en una sola transacción**. Si algo falla,
SQLite hace `ROLLBACK` y no queda ningún registro a medias.

### Principios aplicados

- **Repository Pattern**: `domain/*/repository.ts` define el puerto;
  `repositories/sqlite/*` lo implementa.
- **Sin SQL en servicios**: el dominio solo llama a interfaces.
- **Funciones puras**: `totales.ts`, `validation.ts`, `date.ts` y `mappers.ts`
  no tienen efectos secundarios.
- **Tipado estricto**: `strict`, `noUncheckedIndexedAccess`, `no-explicit-any`
  (error en ESLint).
- **TDD**: reglas de negocio cubiertas con fakes en memoria; persistencia con
  SQLite real en memoria (`:memory:`).
- **Capa MCP fina**: las tools solo validan la forma de entrada con zod y
  delegan en los servicios ya testeados. Cero lógica de negocio duplicada.

## Requisitos

- Node.js ≥ 20
- PNPM ≥ 9

## Instalación

```bash
pnpm install
```

## Scripts

| Script              | Descripción                                              |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Demo que abre la BD, cuenta registros y calcula el total |
| `pnpm build`        | Compila a `dist/` y copia las migraciones `.sql`         |
| `pnpm start`        | Ejecuta la build compilada (`node dist/index.js`)        |
| `pnpm test`         | Vitest en modo watch                                     |
| `pnpm test:run`     | Vitest una sola pasada (CI)                              |
| `pnpm typecheck`    | Comprueba tipos sin emitir código                        |
| `pnpm lint`         | ESLint sobre todo el proyecto                            |
| `pnpm lint:fix`     | ESLint con autofix                                       |
| `pnpm format`       | Formatea con Prettier                                    |
| `pnpm format:check` | Comprueba el formato sin escribir                        |
| `pnpm seed`         | Crea la BD, migra e inserta datos de prueba (10/5/10)    |
| `pnpm mcp`          | Arranca el servidor MCP compilado por stdio              |
| `pnpm mcp:dev`      | Arranca el servidor MCP sin compilar (tsx)               |

## Base de datos

Tres tablas con foreign keys activas (`PRAGMA foreign_keys = ON`):

- **producto**: `id, nombre, descripcion, precio, stock, activo, created_at`
- **cliente**: `id, nombre, email (UNIQUE), telefono, created_at`
- **pedido**: `id, cliente_id → cliente, producto_id → producto, cantidad,
precio_unitario, created_at`

El fichero por defecto es `data/database.sqlite` (ignorado en git). Las
migraciones viven en `src/database/migrations/NNN_*.sql` y se aplican de forma
idempotente, registradas en la tabla `schema_migrations`.

## Funcionalidades

- CRUD completo de productos, clientes y pedidos.
- Búsqueda de productos por nombre (parcial, sin distinguir mayúsculas).
- Búsqueda de clientes por email (case-insensitive).
- Validación de stock antes de crear un pedido.
- Cálculo de total por pedido, por cliente y general.
- Creación de pedidos con descuento de stock **atómico** (transacción).

## Uso rápido (API)

```ts
import { crearAplicacion } from './src/index.js';
import { createDatabaseConfig } from './src/config/database.js';

const app = crearAplicacion(createDatabaseConfig());

const producto = app.productos.crear({ nombre: 'Teclado', precio: 89.5, stock: 10 });
const cliente = app.clientes.crear({ nombre: 'Ana', email: 'ana@example.com' });
const pedido = app.pedidos.crear({
  cliente_id: cliente.id,
  producto_id: producto.id,
  cantidad: 2,
});

console.log(pedido.total); // 179.00
app.cerrar();
```

## Servidor MCP

Una capa fina en `src/mcp/` expone el inventario como **19 tools** que un agente
de IA puede llamar. No duplica lógica: cada tool valida la forma de entrada con
zod y delega en los servicios existentes.

### Tools disponibles

| Dominio  | Tools                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| producto | `listar_productos`, `obtener_producto`, `buscar_productos_por_nombre`, `crear_producto`, `actualizar_producto`, `eliminar_producto`           |
| cliente  | `listar_clientes`, `obtener_cliente`, `buscar_cliente_por_email`, `crear_cliente`, `actualizar_cliente`, `eliminar_cliente`                   |
| pedido   | `crear_pedido`, `listar_pedidos`, `obtener_pedido`, `listar_pedidos_por_cliente`, `total_pedidos_cliente`, `total_general`, `eliminar_pedido` |

`crear_pedido` es la más relevante: valida cliente/producto/stock y ejecuta la
creación y el descuento de stock en **una única transacción**.

### Ejecutar el servidor

```bash
pnpm build      # necesario: el MCP corre sobre dist/
pnpm mcp        # arranca por stdio
```

Sin compilar: `pnpm mcp:dev`.

> En stdio, **stdout es el canal del protocolo**. Todo log de este servidor va
> por `console.error` (stderr); un `console.log` lo corrompería.

### Conectar con OpenCode

La config está en `Database_1/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "inventario": {
        "type": "local",
        "command": ["/home/leo/.local/bin/node", "dist/mcp/index.js"],
        "cwd": "/home/leo/Documents/Respaldo/Git/Database-Inventario/Database_1",
        "protocol": "auto",
      },
    },
  },
}
```

Comprobar la conexión:

```bash
opencode mcp list     # debe decir: ✓ inventario connected
```

Las tools aparecen en OpenCode como `inventario_crear_pedido`,
`inventario_buscar_productos_por_nombre`, etc.

**Notas:**

- La ruta absoluta a `node` es necesaria porque el PATH que hereda el proceso
  de OpenCode no incluye `~/.local/bin`.
- `protocol: "auto"` hace que se negocie la revisión (el SDK v2 habla
  `2026-07-28`; OpenCode por defecto `legacy`).

### Probar el MCP sin un cliente IA

```bash
node scripts/smoke-mcp.mjs
```

Arranca el servidor compilado por stdio, lista las 19 tools y ejecuta una
llamada real de punta a punta.

## Tests

**163 tests en 8 ficheros** (`pnpm test:run`):

- `tests/unit/` — servicios con fakes en memoria (sin SQLite), funciones puras
  y helpers MCP.
- `tests/integration/` — repositorios SQLite reales sobre `:memory:`, seed y el
  servidor MCP conectado vía transporte in-memory.

## Notas de implementación

- **TypeScript se fijó en 5.9.x**: `typescript-eslint` aún no soporta la 7.0
  (compilador nativo).
- **`LIKE` en SQLite solo pliega ASCII**: la búsqueda no distingue mayúsculas
  para caracteres como `Á/á`. Está documentado explícitamente en un test.
- El build copia los `.sql` a `dist/database/migrations/`, y la resolución de
  rutas busca `src/` primero y `dist/` después, de modo que `pnpm start` y
  `pnpm mcp` funcionan sin configuración adicional.
- Los errores de negocio (`ValidationError`, `NotFoundError`, `ConflictError`,
  `InsufficientStockError`) llegan al cliente MCP como `isError: true` con el
  mensaje; nunca tumban el servidor.

## Resolución de problemas

| Problema                                        | Causa y solución                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`           | Estás fuera de `Database_1/`. Haz `cd` dentro de esa carpeta antes de ejecutar pnpm.              |
| `opencode mcp list` → `failed: NotFound: spawn` | `node` no está en el PATH heredado. Usa la ruta absoluta en `command` (ya está así en la config). |
| `opencode mcp list` → `No MCP servers`          | La config está en `Database_1/`; ejecuta el comando desde ahí o añade `--global`.                 |
| El MCP no ve datos                              | Falta `pnpm build` tras cambios, o no se ha hecho `pnpm seed`.                                    |
