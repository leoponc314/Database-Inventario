/**
 * Errores de aplicación tipados.
 *
 * Cada error de negocio tiene un `code` estable que permite clasificarlo sin
 * depender del mensaje (útil para tests, logging y capas superiores).
 */

export type CodigoError =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INSUFFICIENT_STOCK' | 'DATABASE_ERROR';

export interface AppErrorOptions {
  /** Causa raíz del error (por ejemplo, el error original de SQLite). */
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: CodigoError;

  constructor(code: CodigoError, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    // Mantiene el prototype correcto cuando se transpila a ES5/ES2015.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Datos inválidos según las reglas de negocio. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

/** El recurso solicitado no existe. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message);
  }
}

/** Conflicto de unicidad (por ejemplo, email duplicado). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

/** No hay stock suficiente para la cantidad solicitada. */
export class InsufficientStockError extends AppError {
  readonly productoId: number;
  readonly stockDisponible: number;
  readonly cantidadSolicitada: number;

  constructor(productoId: number, stockDisponible: number, cantidadSolicitada: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Stock insuficiente para el producto ${productoId}: ` +
        `disponible ${stockDisponible}, solicitado ${cantidadSolicitada}.`,
    );
    this.productoId = productoId;
    this.stockDisponible = stockDisponible;
    this.cantidadSolicitada = cantidadSolicitada;
  }
}

/** Error inesperado de la capa de persistencia. */
export class DatabaseError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super('DATABASE_ERROR', message, options);
  }
}
