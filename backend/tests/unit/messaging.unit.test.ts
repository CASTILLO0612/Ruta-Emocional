import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AppError } from '../../src/shared/domain/appError';
import {
  parseMessagePageQuery,
  parsePageQuery,
  parseSendMessage,
  parseUuid,
} from '../../src/modules/messaging/presentation/messagingValidation';
import { createTestConfig } from '../support/testConfig';

const config = createTestConfig(
  'postgresql://integration.invalid/ruta_emocional',
  'messaging-unit'
).messaging;

test('message validation accepts only normalized text without actor fields', () => {
  const clientMessageId = randomUUID();
  assert.deepEqual(parseSendMessage({
    clientMessageId,
    type: 'TEXT',
    text: '  Mensaje seguro.  ',
  }, config), {
    clientMessageId,
    type: 'TEXT',
    text: 'Mensaje seguro.',
  });
  assert.throws(() => parseSendMessage({
    clientMessageId: randomUUID(),
    type: 'TEXT',
    text: 'Mensaje',
    senderId: randomUUID(),
    senderName: 'Suplantado',
  }, config), (error: unknown) => error instanceof AppError
    && error.errors?.filter(({ code }) => code === 'UNKNOWN_FIELD').length === 2);
  assert.throws(() => parseSendMessage({
    clientMessageId: randomUUID(),
    type: 'IMAGE',
    text: 'Archivo',
  }, config), AppError);
});

test('message cursors, direction and identifiers fail closed', () => {
  const id = randomUUID();
  const cursor = Buffer.from(JSON.stringify({
    occurredAt: new Date().toISOString(),
    id,
  })).toString('base64url');
  assert.equal(parseUuid(id.toUpperCase(), 'conversationId'), id);
  assert.deepEqual(parsePageQuery({ limit: '10' }, config), { limit: 10 });
  const parsed = parseMessagePageQuery({ cursor, direction: 'after', limit: '20' }, config);
  assert.equal(parsed.direction, 'after');
  assert.equal(parsed.limit, 20);
  assert.equal(parsed.cursor?.id, id);
  assert.ok(parsed.cursor?.occurredAt instanceof Date);
  assert.throws(() => parseMessagePageQuery({ direction: 'after' }, config), AppError);
  assert.throws(() => parseMessagePageQuery({ direction: 'sideways' }, config), AppError);
  assert.throws(() => parseUuid('room-1', 'conversationId'), AppError);
});
