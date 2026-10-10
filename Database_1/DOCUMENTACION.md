# Documentación técnica — Database_1

Registro completo de lo construido, las decisiones tomadas y los problemas
resueltos. Pensado como memoria del proyecto para quien lo retome.

- **Fecha**: octubre de 2026
- **Estado final**: ✅ 163 tests en verde · lint limpio · build correcto ·
  servidor MCP conectado en OpenCode
- **Volumen**: ~2.000 líneas en `src/`, ~1.800 en `tests/`

---

## 1. Objetivos pedidos

1. Proyecto **Database_1** desde cero para gestionar una base **SQLite local**.
2. Stack: Node.js, TypeScript, SQLite, **PNPM** (no npm), Vitest, ESLint,
   Prettier.
3. Buenas prácticas: separación de responsabilidades, funciones puras, tipado
   estricto, Repository Pattern, **sin SQL en servicios**, TDD.
4. CRUD de productos, clientes y pedidos, más: búsqueda de producto por nombre,
   búsqueda de cliente por email, validación de stock, cálculo de total,
   descuento de stock al crear un pedido y **transacción** para esa operación.
5. Seed con 10 productos / 5 clientes / 10 pedidos ejecutable con `pnpm seed`.
6. Scripts: `dev`, `build`, `test`, `test:run`, `lint`, `format`, `seed`.
7. Fase 2: exponer todo como **servidor MCP local (stdio)** para OpenCode.

---

## 2. Arquitectura resultante

Patrón en capas con dependencias hacia dentro. El dominio no importa nada de
la infraestructura; la implementación SQLite depende del dominio, no al revés.

```text
config/ ──► database/ ──► repositories/sqlite/ ──► domain/
                                                   (solo interfaces)
```

- `src/config/database.ts` — objeto de configuración puro e inyectable.
  `createDatabaseConfig()` combina valores por defecto con overrides. En tests
  basta pasar `filename: ':memory:'`.
- `src/database/connection.ts` — abre SQLite y aplica pragmas. Puntos clave:
  `foreign_keys = ON` (SQLite los trae **desactivados** por conexión) y WAL.
  Crea el directorio contenedor si no existe.
- `src/database/migrations.ts` — lee `NNN_*.sql`, los ordena por nombre, aplica
  cada uno en su transacción y los registra en `schema_migrations`. Idempotente.
- `src/domain/{producto,cliente,pedido}/` — cada uno con `types.ts` (entidades),
  `repository.ts` (**puerto**, interfaz), `validacion.ts` (reglas puras) y
  `service.ts` (casos de uso). `pedido` añade `totales.ts` (cálculo puro).
- `src/repositories/sqlite/` — las **únicas** clases con SQL. Cada una
  implementa el puerto de su dominio. `mappers.ts` centraliza la conversión
  booleano ⇄ INTEGER 0/1.
- `src/index.ts` — **composition root**. Único punto que instancia los
  repositorios concretos. Expone `crearAplicacion(config)`.
- `src/mcp/` — servidor MCP. Capa fina: valida forma de entrada con zod y
  delega en los servicios.

### El pedido: la transacción

`SqlitePedidoRepository.crear()` es el corazón atómico:

1. `db.transaction(...)` envuelve todo.
2. Se inserta el pedido.
3. `UPDATE producto SET stock = stock - ? WHERE id = ? AND stock >= ?` — el
   descuento es **condicional**: solo descuenta si queda stock.
4. Si `changes === 0`, se lanza `InsufficientStockError` y better-sqlite3 hace
   `ROLLBACK` automático. No queda ni el pedido ni el stock tocado.

El servicio valida antes (cliente, producto, activo, stock) para dar mensajes
claros; el repositorio vuelve a comprobar dentro de la transacción porque es la
única fuente de verdad. Es validación en dos capas, deliberada.

---

## 3. Decisiones y su porqué

| Decisión                                        | Motivo                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **better-sqlite3**                              | Síncrono, rápido, API simple, transacciones nativas. Ideal para BD local.                                                      |
| **ESM (`"type": "module"`)**                    | Estándar moderno de Node; necesario para `import.meta.url`.                                                                    |
| **TypeScript fijado en 5.9.x**                  | `typescript-eslint` no soporta la 7.0 (compilador nativo Go). Se instaló 7.0.2 primero y rompía ESLint.                        |
| **Errores tipados con `code`**                  | Permiten clasificar sin parsear mensajes: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_STOCK`, `DATABASE_ERROR`. |
| **Interfaces de repositorio en `domain/`**      | El dominio define QUÉ necesita; SQLite decide CÓMO. Permite testear servicios sin SQLite.                                      |
| **Fakes en memoria en `tests/helpers/`**        | Tests unitarios rápidos y sin dependencia de BD.                                                                               |
| **`eslint.config.mjs` / `prettier.config.mjs`** | El proyecto es ESM; los `.mjs` evitan ambigüedad.                                                                              |
| **SDK MCP v2 (`@modelcontextprotocol/server`)** | Línea estable desde julio 2026. La v1 sigue manteniendo seguridad.                                                             |
| **Ruta absoluta a `node` en `opencode.jsonc`**  | El PATH heredado por el proceso de OpenCode no incluye `~/.local/bin`.                                                         |
| **`protocol: "auto"`**                          | Negocia revisión: SDK v2 habla `2026-07-28`, OpenCode por defecto `legacy`.                                                    |

---

## 4. Problemas encontrados y cómo se resolvieron

Registro de bugs reales detectados (casi todos por los propios tests).

### Entorno

1. **Node.js no estaba instalado.** Se descargó el binario oficial v24.21.0
   (LTS) a `~/.local/opt/node` y se enlazó en `~/.local/bin`, añadiéndolo a
   `.bashrc`. Igual para PNPM 10.34.6.
2. **`typescript-eslint` fallaba con TS 7.0.** Se degradó a TypeScript 5.9.3.
3. **El PATH de OpenCode no veía `node`.** El spawn del servidor MCP fallaba
   con `NotFound: ChildProcess.spawn`. Se confirmó con `env -i` y se solucionó
   usando la ruta absoluta en `command`.

### Código (detectados por tests)

4. **Descripción/teléfono con solo espacios.** `normalizarTexto('   ')` daba
   `''`, que no es `null`. Resultado: descripciones vacías guardadas como `''`.
   Corregido convirtiendo `''` a `null` tras normalizar.
5. **Rutas tras el build.** `import.meta.url` + `../..` apuntaba mal bajo
   `dist/`, y `data/` no se creaba. La build compilada no arrancaba. Corregido
   con búsqueda de `package.json` para hallar la raíz y `mkdirSync` en
   `openDatabase`. Además el build copia los `.sql` a `dist/`.
6. **Tipo de parámetros en `prepare()`.** Dos `UPDATE` con 3 marcadores estaban
   tipados como `[number, number]`. Corregido a `[number, number, number]`.
7. **Fallo del test de foreign keys.** Había un alias `'pedido' AS "table"` que
   eclipsaba la columna real del pragma. Corregido el test.
8. **`LIKE` no pliega no-ASCII.** `MECÁNICO` no coincide con `Mecánico` en
   SQLite. No es un bug sino una limitación; se documentó con un test explícito
   para que no sorprenda en producción.

### MCP

9. **Ruta de import incorrecta** en `helpers.ts` (`../../utils/` en vez de
   `../utils/`), que enmascaraba un segundo error de tipado.
10. **`client.getServerInfo` no existe en v2.** El método correcto es
    `getServerVersion`.
11. **El helper de test hacía `JSON.parse` incondicional.** Los resultados de
    error llevan texto plano, no JSON. Se parsea solo si no es `isError`.
12. **Lint fallaba en `scripts/*.mjs`** por globals de Node no declarados. Se
    añadió un bloque `languageOptions.globals`.

---

## 5. Verificación final (todo en verde)

| Paso                         | Resultado                                 |
| ---------------------------- | ----------------------------------------- |
| `pnpm test:run`              | ✅ 163 tests, 8 ficheros, 0 fallos        |
| `pnpm lint`                  | ✅ 0 errores                              |
| `pnpm typecheck`             | ✅                                        |
| `pnpm build`                 | ✅ `dist/` + migraciones `.sql` copiadas  |
| `pnpm format:check`          | ✅                                        |
| `pnpm seed`                  | ✅ 10 productos / 5 clientes / 10 pedidos |
| `opencode mcp list`          | ✅ `✓ inventario connected`               |
| `node scripts/smoke-mcp.mjs` | ✅ 19 tools, creación y total reales      |

### Reparto de tests

| Fichero                                         | Tests |
| ----------------------------------------------- | ----- |
| `tests/unit/pedido.service.test.ts`             | 29    |
| `tests/integration/sqlite.repositories.test.ts` | 28    |
| `tests/unit/cliente.service.test.ts`            | 27    |
| `tests/unit/producto.service.test.ts`           | 24    |
| `tests/unit/validation.test.ts`                 | 23    |
| `tests/integration/mcp.server.test.ts`          | 18    |
| `tests/unit/mcp.tools.test.ts`                  | 7     |
| `tests/integration/seed.test.ts`                | 7     |

---

## 6. Cómo ejecutarlo (resumen)

```bash
cd ~/Documents/Respaldo/Git/Database-Inventario/Database_1
pnpm install
pnpm seed          # crea la BD con datos de prueba
pnpm test:run      # 163 tests
pnpm dev           # demo: conteos + total general
```

Para el servidor MCP:

```bash
pnpm build
opencode mcp list  # → ✓ inventario connected
```

> Todos los comandos pnpm se ejecutan **dentro de `Database_1/`**. Ejecutarlos
> en la carpeta del repo produce `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`, porque
> el `package.json` está en `Database_1/`.

---

## 7. Estado de Git

El repo apunta a `github.com/leoponc314/Database-Inventario` (rama `main`),
con 2 commits previos. Al escribir esta documentación, `Database_1/` todavía
no estaba commiteado: el directorio completo aparecía como sin seguimiento
(`??`) y el `README.md` de la raíz del repo constaba como borrado (era el
`# Hola mundo!` original).

Para versionarlo:

```bash
cd ~/Documents/Respaldo/Git/Database-Inventario
git add -A
git commit -m "feat: Database_1 + servidor MCP de inventario"
git push
```
