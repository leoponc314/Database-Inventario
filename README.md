# Database-Inventario

Repositorio que contiene el proyecto **Database_1**: gestión y consulta de una
base de datos **SQLite local** con Node.js y TypeScript, expuesta además como
**servidor MCP** para agentes de IA.

## Contenido

| Carpeta                      | Descripción                                     |
| ---------------------------- | ----------------------------------------------- |
| [`Database_1/`](Database_1/) | Proyecto completo: código, tests y servidor MCP |

## Documentación

- **[`Database_1/README.md`](Database_1/README.md)** — guía de uso: instalación,
  scripts, arquitectura, servidor MCP y resolución de problemas.
- **[`Database_1/DOCUMENTACION.md`](Database_1/DOCUMENTACION.md)** — documentación
  técnica: decisiones de diseño, problemas resueltos y estado del proyecto.

## Arranque rápido

```bash
cd Database_1
pnpm install
pnpm seed        # crea la BD con datos de prueba (10 productos / 5 clientes / 10 pedidos)
pnpm test:run    # 163 tests
pnpm dev         # demo: conteos + total general
```

> Todos los comandos pnpm se ejecutan dentro de `Database_1/`, donde está el
> `package.json`.
