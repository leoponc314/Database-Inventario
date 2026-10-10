import { describe, expect, it } from 'vitest';
import {
  esEmailValido,
  esEnteroNoNegativo,
  esEnteroPositivo,
  esIdValido,
  esNumeroNoNegativo,
  esTextoNoVacio,
  normalizarTexto,
  redondearImporte,
} from '../../src/utils/validation.js';

describe('normalizarTexto', () => {
  it('recorta y colapsa espacios internos', () => {
    expect(normalizarTexto('  hola   mundo  ')).toBe('hola mundo');
    expect(normalizarTexto('sin\tespacios\nraros')).toBe('sin espacios raros');
    expect(normalizarTexto('   ')).toBe('');
  });
});

describe('esTextoNoVacio', () => {
  it.each([
    ['texto', 'hola', true],
    ['con espacios alrededor', '  hola  ', true],
    ['vacío', '', false],
    ['solo espacios', '   ', false],
    ['no string', 42, false],
    ['null', null, false],
  ])('%s -> %s', (_caso, valor, esperado) => {
    expect(esTextoNoVacio(valor)).toBe(esperado);
  });
});

describe('esEmailValido', () => {
  it.each([
    ['válido simple', 'a@b.co', true],
    ['válido con subdominio', 'usuario@sub.dominio.com', true],
    ['válido con puntos', 'user.name+tag@example.com', true],
    ['sin arroba', 'userexample.com', false],
    ['sin dominio', 'user@dominio', false],
    ['sin parte local', '@example.com', false],
    ['con espacios', 'us er@example.com', false],
    ['vacío', '', false],
    ['no string', 123, false],
    ['demasiado largo', `${'a'.repeat(250)}@b.co`, false],
  ])('%s -> %s', (_caso, valor, esperado) => {
    expect(esEmailValido(valor)).toBe(esperado);
  });
});

describe('validadores numéricos', () => {
  it('esEnteroNoNegativo', () => {
    expect(esEnteroNoNegativo(0)).toBe(true);
    expect(esEnteroNoNegativo(5)).toBe(true);
    expect(esEnteroNoNegativo(-1)).toBe(false);
    expect(esEnteroNoNegativo(1.5)).toBe(false);
    expect(esEnteroNoNegativo('5')).toBe(false);
  });

  it('esEnteroPositivo', () => {
    expect(esEnteroPositivo(1)).toBe(true);
    expect(esEnteroPositivo(0)).toBe(false);
    expect(esEnteroPositivo(-3)).toBe(false);
  });

  it('esNumeroNoNegativo admite decimales', () => {
    expect(esNumeroNoNegativo(0)).toBe(true);
    expect(esNumeroNoNegativo(10.5)).toBe(true);
    expect(esNumeroNoNegativo(-0.01)).toBe(false);
    expect(esNumeroNoNegativo(Number.NaN)).toBe(false);
    expect(esNumeroNoNegativo(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('esIdValido es entero estrictamente positivo', () => {
    expect(esIdValido(1)).toBe(true);
    expect(esIdValido(0)).toBe(false);
    expect(esIdValido(-1)).toBe(false);
    expect(esIdValido(1.5)).toBe(false);
  });
});

describe('redondearImporte', () => {
  it('redondea a 2 decimales', () => {
    expect(redondearImporte(19.999)).toBe(20);
    expect(redondearImporte(19.994)).toBe(19.99);
    expect(redondearImporte(0)).toBe(0);
  });

  it('corrige errores de coma flotante', () => {
    expect(redondearImporte(0.1 + 0.2)).toBe(0.3);
  });
});
