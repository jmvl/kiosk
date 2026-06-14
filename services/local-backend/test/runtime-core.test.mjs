import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  canonicalTicketPayload,
  appendEvent,
  createSession,
  createTicket,
  migrateDatabase,
  openLocalDatabase,
  ticketCheck,
  transitionSession,
} from '../dist/index.js';

function testDb() {
  const dir = mkdtempSync(join(tmpdir(), 'retail-kiosk-local-'));
  const db = openLocalDatabase(join(dir, 'runtime.sqlite'));
  migrateDatabase(db);
  return { db, dir };
}

describe('local runtime SQLite core', () => {
  it('applies SQLite durability policy during open', () => {
    const { db } = testDb();
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(db.pragma('busy_timeout', { simple: true }), 5000);
  });

  it('appends events transactionally with monotonic sequence and outbox row', () => {
    const { db } = testDb();
    const first = appendEvent(db, {
      kioskId: 'HQ001',
      eventType: 'token_received',
      payload: { cents: 100 },
    });
    const second = appendEvent(db, {
      kioskId: 'HQ001',
      eventType: 'session_starting',
      payload: {},
    });

    assert.equal(first.local_sequence, 1);
    assert.equal(second.local_sequence, 2);
    assert.equal(db.prepare('select count(*) as count from events').get().count, 2);
    assert.equal(db.prepare('select count(*) as count from sync_queue').get().count, 2);
  });

  it('rolls back event append when the transaction fails', () => {
    const { db } = testDb();
    assert.throws(() => appendEvent(db, {
      kioskId: 'HQ001',
      eventType: 'bad_event',
      payload: {},
      simulateFailureAfterEventInsert: true,
    }), /simulated transaction failure/);

    assert.equal(db.prepare('select count(*) as count from events').get().count, 0);
    assert.equal(db.prepare('select count(*) as count from sync_queue').get().count, 0);
    assert.equal(db.prepare('select local_sequence from runtime_state where id = 1').get().local_sequence, 0);
  });

  it('enforces session state transitions', () => {
    const { db } = testDb();
    const session = createSession(db, {
      kioskId: 'HQ001',
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
    });
    assert.equal(session.state, 'token_received');

    transitionSession(db, session.session_id, 'session_starting');
    transitionSession(db, session.session_id, 'playing');
    transitionSession(db, session.session_id, 'result_pending');
    transitionSession(db, session.session_id, 'print_requested');
    transitionSession(db, session.session_id, 'printing');
    const completed = transitionSession(db, session.session_id, 'completed');
    assert.equal(completed.state, 'completed');
    assert.ok(completed.completed_at);

    assert.throws(() => transitionSession(db, session.session_id, 'playing'), /invalid session transition/);
  });

  it('rejects creating a second session while another session is active', () => {
    const { db } = testDb();
    const first = createSession(db, {
      kioskId: 'HQ001',
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
    });
    transitionSession(db, first.session_id, 'session_starting');
    transitionSession(db, first.session_id, 'playing');

    assert.throws(() => createSession(db, {
      kioskId: 'HQ001',
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
    }), /active session already exists/);

    assert.equal(db.prepare('select count(*) as count from sessions').get().count, 1);
    assert.equal(db.prepare('select current_session_id from runtime_state where id = 1').get().current_session_id, first.session_id);
  });

  it('rejects ticket metadata that does not match the authoritative session row', () => {
    const { db, dir } = testDb();
    const secretPath = join(dir, 'ticket-signing.env');
    writeFileSync(secretPath, 'TICKET_SIGNING_SECRET=test-pilot-secret\nTICKET_SIGNING_KEY_VERSION=pilot-v1\n');
    const session = createSession(db, {
      kioskId: 'HQ001',
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
    });

    assert.throws(() => createTicket(db, {
      kioskId: 'EVIL-KIOSK',
      kioskShortId: 'EVIL',
      sessionId: session.session_id,
      packageId: 'wrong-package',
      packageVersion: '9.9.9',
      campaignShortCode: 'BAD',
      renderPayload: { prize: 'sample' },
      secretFilePath: secretPath,
    }), /ticket metadata mismatch/);

    assert.equal(db.prepare('select count(*) as count from tickets').get().count, 0);
  });

  it('derives ticket-code kiosk prefix from the authoritative session row', () => {
    const { db, dir } = testDb();
    const secretPath = join(dir, 'ticket-signing.env');
    writeFileSync(secretPath, 'TICKET_SIGNING_SECRET=test-pilot-secret\nTICKET_SIGNING_KEY_VERSION=pilot-v1\n');
    const session = createSession(db, {
      kioskId: 'HQ001',
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
    });

    const ticket = createTicket(db, {
      kioskId: 'HQ001',
      kioskShortId: 'EVIL',
      sessionId: session.session_id,
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
      campaignShortCode: 'CHO',
      renderPayload: { prize: 'sample' },
      secretFilePath: secretPath,
    });

    assert.match(ticket.ticket_code, /^CHO-HQ001-[0-9A-HJKMNP-TV-Z]{12}-[0-9A-HJKMNP-TV-Z]{6}$/);
    assert.doesNotMatch(ticket.ticket_code, /EVIL/);
    assert.equal(ticket.kiosk_id, 'HQ001');
    assert.equal(db.prepare('select count(*) as count from tickets').get().count, 1);
  });

  it('creates ULID ticket codes with public id and HMAC check from configured secret file', () => {
    const { db, dir } = testDb();
    const secretPath = join(dir, 'ticket-signing.env');
    writeFileSync(secretPath, 'TICKET_SIGNING_SECRET=test-pilot-secret\nTICKET_SIGNING_KEY_VERSION=pilot-v1\n');
    const session = createSession(db, {
      kioskId: 'HQ001',
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
    });

    const ticket = createTicket(db, {
      kioskId: 'HQ001',
      kioskShortId: 'HQ001',
      sessionId: session.session_id,
      packageId: 'chocomel-wheel',
      packageVersion: '1.0.0',
      campaignShortCode: 'CHO',
      renderPayload: { prize: 'sample' },
      secretFilePath: secretPath,
    });

    assert.match(ticket.ticket_id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.match(ticket.public_ticket_id, /^[0-9A-HJKMNP-TV-Z]{12}$/);
    assert.match(ticket.ticket_code, /^CHO-HQ001-[0-9A-HJKMNP-TV-Z]{12}-[0-9A-HJKMNP-TV-Z]{6}$/);
    assert.equal(ticket.hmac_algorithm, 'HMAC-SHA-256');
    assert.equal(ticket.key_version, 'pilot-v1');
    assert.equal(ticket.check_length, 6);
    const expectedCheck = ticketCheck('test-pilot-secret', canonicalTicketPayload({
      ticketId: ticket.ticket_id,
      publicTicketId: ticket.public_ticket_id,
      kioskId: ticket.kiosk_id,
      sessionId: ticket.session_id,
      packageId: ticket.package_id,
      packageVersion: ticket.package_version,
      campaignShortCode: ticket.campaign_short_code,
      redemptionModel: ticket.redemption_model,
      renderPayload: ticket.render_payload,
    }), 6);
    assert.equal(ticket.ticket_code.split('-').at(-1), expectedCheck);
    assert.equal(db.prepare('select count(*) as count from tickets').get().count, 1);
  });
});
