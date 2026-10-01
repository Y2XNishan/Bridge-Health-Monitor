import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAuditLogs } from './adminPanelUtils.js';

test('audit filter keeps all actual events or only the selected status', () => {
  const events = [
    { id: '1', status: 'SUCCESS' },
    { id: '2', status: 'DENIED' },
    { id: '3', status: 'FAILED' },
  ];
  assert.deepEqual(filterAuditLogs(events, 'ALL'), events);
  assert.deepEqual(filterAuditLogs(events, 'DENIED'), [events[1]]);
  assert.deepEqual(filterAuditLogs(events, 'FAILED'), [events[2]]);
  assert.deepEqual(filterAuditLogs(events, 'UNKNOWN'), []);
  assert.deepEqual(filterAuditLogs([], 'ALL'), []);
});
