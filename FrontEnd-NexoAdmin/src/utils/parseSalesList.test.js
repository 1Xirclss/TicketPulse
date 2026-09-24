import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalesList } from './parseSalesList.js';

test('lee nombres acentuados y métodos abreviados, incluso EFECTICO', () => {
  const rows = parseSalesList('Mónica Álvarez EFECTIVO\nCamila Del Cid TRANSF\nJordi Hernández EFECTICO\nFernanda Guerrero TRANSF');
  assert.deepEqual(rows.map(({ name, method, error }) => ({ name, method, error })), [
    { name: 'Mónica Álvarez', method: 'Efectivo', error: '' },
    { name: 'Camila Del Cid', method: 'Transferencia', error: '' },
    { name: 'Jordi Hernández', method: 'Efectivo', error: '' },
    { name: 'Fernanda Guerrero', method: 'Transferencia', error: '' }
  ]);
});

test('no inventa métodos ni registra líneas ambiguas', () => {
  const rows = parseSalesList('Ana Pérez\nLuis García TARJETA\n1. Rosa Gómez - EFECTIVO');
  assert.equal(rows[0].error, 'Falta el método de pago.');
  assert.equal(rows[1].error, 'Método de pago no reconocido.');
  assert.equal(rows[2].name, 'Rosa Gómez');
  assert.equal(rows[2].method, 'Efectivo');
});

test('procesa completa la lista de 22 asistentes del ejemplo', () => {
  const rows = parseSalesList(`Mónica Álvarez EFECTIVO
Camila Del Cid TRANSF
Michell López TRANSF
Belén Alfaro TRANSF
Valeria Girón TRANSF
Jimena Figueroa TRANSF
René Garay TRANSF
Isabella Arévalo EFECTIVO
Natalia Argueta EFECTIVO
Male Rivas EFECTIVO
Andrea Chacón EFECTIVO
Lucia Zelaya EFECTIVO
Erick Paredes EFECTIVO
Ximena Hernández EFECTIVO
Natalia Hernández EFECTIVO
Tatiana Sánchez EFECTIVO
Emiliano Amaya EFECTIVO
Sofía Rodríguez EFECTIVO
Jordi Hernández EFECTICO
Emanuel Rios TRANSF
Diego Somoza TRANSF
Fernanda Guerrero TRANSF`);
  assert.equal(rows.length, 22);
  assert.equal(rows.filter(row => row.error).length, 0);
  assert.equal(rows.filter(row => row.method === 'Efectivo').length, 13);
  assert.equal(rows.filter(row => row.method === 'Transferencia').length, 9);
});
