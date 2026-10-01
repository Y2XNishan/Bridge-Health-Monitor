export function alertFingerprint(alert) {
  const healthTrigger = alert.triggers?.some((trigger) => trigger.startsWith('Health score')) ? 'health-critical' : '';
  const breached = (alert.breaches || [])
    .map((item) => `${item.sensor}:${item.status}`)
    .sort()
    .join('|');
  return `${alert.bridge_id}:${healthTrigger}:${breached}`;
}

export function formatNetworkAlert(alert, selectedBridgeId, selectedBridgeName) {
  const triggers = alert.triggers?.length ? alert.triggers.map((item) => `- ${item}`).join('\n') : '- Trigger unavailable; verify current telemetry.';
  const breaches = alert.breaches?.length
    ? alert.breaches.map((item) => `- ${item.label}: ${Number(item.reading).toFixed(3)} ${item.unit} (${item.status}; project threshold ${Number(item.threshold).toFixed(3)} ${item.unit})`).join('\n')
    : '- No sensor threshold breaches recorded; the Critical condition is based on health score.';
  const context = Number(alert.bridge_id) === Number(selectedBridgeId)
    ? 'This is the selected bridge.'
    : `Selected bridge: ${selectedBridgeName}. This network alert concerns ${alert.bridge_name}.`;
  return `**Network alert — ${alert.bridge_name}**\n\n**Critical trigger**\n${triggers}\n\n**All breached sensors**\n${breaches}\n\n${context}`;
}

export function dispatchMessage(alert) {
  return `Bridge health review requested for ${alert.bridge_name}.\nCritical trigger: ${alert.triggers.join('; ')}.\nPlease verify the current readings and arrange an inspection.`;
}

const tableCells = (line) => line.trim().replace(/^\||\|$/g, '')
  .split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));

export function markdownBlocks(content) {
  const lines = String(content || '').split(/\r?\n/);
  const blocks = [];
  let prose = [];
  let fenced = false;
  const flush = () => { if (prose.length) blocks.push({ type: 'markdown', content: prose.join('\n') }); prose = []; };
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*(```|~~~)/.test(lines[index])) fenced = !fenced;
    const headers = tableCells(lines[index]);
    const divider = index + 1 < lines.length ? tableCells(lines[index + 1]) : [];
    if (!fenced && lines[index].includes('|') && divider.length === headers.length && divider.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      flush();
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      index -= 1;
    } else {
      prose.push(lines[index]);
    }
  }
  flush();
  return blocks;
}
