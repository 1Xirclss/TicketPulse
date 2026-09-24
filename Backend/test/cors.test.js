import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5180';
process.env.JWT_SECRET ||= 'test-only-secret-long-enough-for-cors-check';
const { default: app } = await import('../app.js');

test('el preflight de ventas permite Idempotency-Key desde el frontend', async () => {
  const response = await request(app).options('/api/ventas')
    .set('Origin', 'http://127.0.0.1:5181')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,idempotency-key,authorization');
  assert.equal(response.status, 204);
  assert.match(response.headers['access-control-allow-headers'] || '', /idempotency-key/i);
});
