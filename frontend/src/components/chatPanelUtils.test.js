import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertFingerprint, dispatchMessage, formatNetworkAlert, markdownBlocks } from './chatPanelUtils.js';

const alert = {
  bridge_id: 4, bridge_name: 'Fixture bridge',
  triggers: ['Crack gap 0.690 mm reached the project Critical threshold (0.300 mm)'],
  breaches: [
    { sensor: 'strain', label: 'Strain', reading: 185, unit: 'MPa', status: 'Monitor', threshold: 180 },
    { sensor: 'crack_gap', label: 'Crack gap', reading: 0.6897, unit: 'mm', status: 'Critical', threshold: 0.3 },
  ],
};

test('deduplicates unchanged alert causes despite changing readings', () => {
  assert.equal(alertFingerprint(alert), alertFingerprint({ ...alert, breaches: [{ ...alert.breaches[0], reading: 186 }, alert.breaches[1]] }));
  assert.notEqual(alertFingerprint(alert), alertFingerprint({ ...alert, breaches: [{ ...alert.breaches[0], status: 'Critical' }, alert.breaches[1]] }));
});

test('names network bridge, selected bridge, trigger, and every breached sensor', () => {
  const text = formatNetworkAlert(alert, 1, 'Selected bridge');
  assert.match(text, /Network alert — Fixture bridge/);
  assert.match(text, /Selected bridge: Selected bridge/);
  assert.match(text, /Crack gap: 0\.690 mm/);
  assert.match(text, /Strain: 185\.000 MPa/);
  assert.doesNotMatch(text, /Vibration/);
});

test('dispatch draft states the actual trigger without inventing a crew', () => {
  assert.match(dispatchMessage(alert), /Crack gap 0\.690 mm/);
  assert.doesNotMatch(dispatchMessage(alert), /nearest|available crew|assigned/i);
});

test('separates markdown tables into cells without raw pipe text', () => {
  const blocks = markdownBlocks('Readings\n\n| Sensor | Value |\n| --- | --- |\n| Crack gap | 0.69 mm |');
  assert.equal(blocks[1].type, 'table');
  assert.deepEqual(blocks[1].headers, ['Sensor', 'Value']);
  assert.deepEqual(blocks[1].rows, [['Crack gap', '0.69 mm']]);
});
