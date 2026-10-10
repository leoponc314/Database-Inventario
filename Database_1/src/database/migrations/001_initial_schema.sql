-- Esquema inicial: productos, clientes y pedidos.

CREATE TABLE IF NOT EXISTS producto (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  descripcion   TEXT,
  precio        REAL    NOT NULL,
  stock         INTEGER NOT NULL,
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL,
  CHECK (precio >= 0),
  CHECK (stock >= 0),
  CHECK (activo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS cliente (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  telefono      TEXT,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS pedido (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id     INTEGER NOT NULL,
  producto_id    INTEGER NOT NULL,
  cantidad       INTEGER NOT NULL,
  precio_unitario REAL   NOT NULL,
  created_at     TEXT    NOT NULL,
  FOREIGN KEY (cliente_id)  REFERENCES cliente (id) ON DELETE RESTRICT,
  FOREIGN KEY (producto_id) REFERENCES producto (id) ON DELETE RESTRICT,
  CHECK (cantidad > 0),
  CHECK (precio_unitario >= 0)
);

-- Índices para las búsquedas y joins más frecuentes.
CREATE INDEX IF NOT EXISTS idx_producto_nombre      ON producto (nombre);
CREATE INDEX IF NOT EXISTS idx_cliente_email        ON cliente (email);
CREATE INDEX IF NOT EXISTS idx_pedido_cliente_id    ON pedido (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_producto_id   ON pedido (producto_id);
