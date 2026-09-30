import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ink = '#1C1F26';
const teal = '#0F6E56';
const muted = '#64748B';
const border = '#E2E8F0';
const panel = { background: '#fff', border: '1px solid ' + border, borderRadius: 10, padding: 18 };
const note = { color: muted, fontSize: 13 };
const tone = {
  Healthy: { color: teal, background: '#EAF4F0' },
  Monitor: { color: '#8A641B', background: '#F8F2E6' },
  Critical: { color: '#9B4242', background: '#F9EEEE' },
  Unavailable: { color: muted, background: '#F1F5F9' },
  Low: { color: teal, background: '#EAF4F0' },
  Medium: { color: '#8A641B', background: '#F8F2E6' },
  High: { color: '#8A641B', background: '#F8F2E6' },
};
const urgency = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical', UNAVAILABLE: 'Unavailable' };
const priorityCards = [
  { key: 'CRITICAL', label: 'Critical', color: '#9B4242' },
  { key: 'HIGH', label: 'High', color: '#8A641B' },
  { key: 'MEDIUM', label: 'Medium', color: '#8A641B' },
  { key: 'LOW', label: 'Low', color: teal },
];
const cell = { padding: 9, borderBottom: '1px solid ' + border, textAlign: 'left' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
function dayText(value) { return value == null ? 'Unavailable' : value + (value === 1 ? ' day' : ' days'); }
function dateText(value) { return value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')) : 'Unavailable'; }
function num(value, places = 1) { return value == null ? 'Unavailable' : Number(value).toFixed(places); }
function Badge({ value }) {
  const label = urgency[value] || value || 'Unavailable';
  return <span style={{ ...(tone[label] || tone.Monitor), borderRadius: 5, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>{label}</span>;
}
function Section({ title, children }) { return <section style={panel}><h2 style={{ margin: '0 0 12px', fontSize: 18, color: ink }}>{title}</h2>{children}</section>; }
function Schedule({ title, actions }) {
  return <section style={panel}><h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{title}</h3>
    {Array.isArray(actions) && actions.length ? <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>{actions.map((action, index) => <li key={index}>{action}</li>)}</ul> : <p style={note}>No actions available.</p>}
  </section>;
}
function apiFetch(path, options = {}) {
  return fetch(API + path, { ...options, headers: { Authorization: 'Bearer ' + localStorage.getItem('bridgeiq_token'), ...options.headers } })
    .then(async response => { if (!response.ok) throw new Error('Forecast service returned ' + response.status); return response.json(); });
}
function RepairSimulator({ report }) {
  const [repairDay, setRepairDay] = useState(0);
  const [assumedHealth, setAssumedHealth] = useState(Math.min(100, (report.health_score ?? 0) + 10));
  const [request, setRequest] = useState({ key: null, result: null, error: '' });
  const failureDays = report.survival_predictions?.days_to_failure;
  const requestKey = [report.health_score, report.degradation_rate, report.analysis_date, repairDay, assumedHealth].join(':');
  const result = request.key === requestKey ? request.result : null;
  const error = report.health_score == null || report.degradation_rate == null
    ? 'A repair estimate requires a health score and degradation rate.'
    : request.key === requestKey ? request.error : '';
  const loading = !error && request.key !== requestKey;
  useEffect(() => {
    if (report.health_score == null || report.degradation_rate == null) return undefined;
    const controller = new AbortController();
    apiFetch('/api/survival/simulate', {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ health_score: report.health_score, degradation_rate: report.degradation_rate, analysis_date: report.analysis_date, repair_day: repairDay, post_repair_health: assumedHealth }),
    }).then(data => setRequest({ key: requestKey, result: data, error: '' }))
      .catch(err => { if (err.name !== 'AbortError') setRequest({ key: requestKey, result: null, error: err.message }); });
    return () => controller.abort();
  }, [report.health_score, report.degradation_rate, report.analysis_date, repairDay, assumedHealth, requestKey]);
  const scenario = result?.scenario;
  const boundary = result?.failure_boundary ?? report.health_boundaries?.failure;
  const chartMaxDay = Math.max(1, ...(result?.chart_data || []).map(point => point.day));
  const chartTicks = [...new Set(Array.from({ length: 7 }, (_, index) => Math.round(index * chartMaxDay / 6)))];
  return <Section title="Repair scenario simulator">
    <p style={note}>Simulated estimate based on an assumed post-repair health score, not a repair guarantee. Baseline and repaired paths use the same {boundary}-point failure boundary and degradation rate.</p>
    <div style={{ ...grid, margin: '18px 0' }}>
      <label>Repair timing: {dayText(repairDay)} after inspection
        <input type="range" min="0" max={Math.max(30, (failureDays ?? 30) + 15)} value={repairDay} onChange={event => setRepairDay(Number(event.target.value))} style={{ display: 'block', width: '100%', accentColor: teal }} />
        <small style={note}>Repair date: {result ? dateText(result.repair_date) : 'Unavailable'}</small>
      </label>
      <label>Assumed health after repair: {num(assumedHealth)}/100
        <input type="range" min="0" max="100" step="0.1" value={assumedHealth} onChange={event => setAssumedHealth(Number(event.target.value))} style={{ display: 'block', width: '100%', accentColor: teal }} />
        <small style={note}>This is a scenario input, not a predicted improvement.</small>
      </label>
    </div>
    {loading && <p style={note}>Updating simulation…</p>}
    {error && <p role="alert" style={{ color: tone.Critical.color }}>{error}</p>}
    {result && <>
      <div style={grid}>{[
        ['Baseline from inspection', dayText(result.baseline_days), dateText(result.baseline_failure_date)],
        ['Time after repair', scenario?.available ? dayText(scenario.days_after_repair) : 'Unavailable', 'From repair date'],
        ['Total from inspection', scenario?.available ? dayText(scenario.total_days_from_today) : 'Unavailable', scenario?.available ? dateText(scenario.repaired_failure_date) : ''],
        ['Additional days gained', scenario?.available ? dayText(scenario.additional_days_gained) : 'Unavailable', 'Versus baseline'],
      ].map(([label, value, detail]) => <div key={label} style={{ ...panel, padding: 13 }}><div style={note}>{label}</div><strong style={{ display: 'block', fontSize: 19, margin: '5px 0' }}>{value}</strong><div style={note}>{detail}</div></div>)}</div>
      {!scenario?.available && <p style={{ color: tone.Critical.color }}>{scenario?.reason}. No post-repair estimate is available for this scenario.</p>}
      {scenario?.available && <p style={note}>Health at repair: {num(scenario.health_at_repair)}/100; assumed after repair: {num(scenario.post_repair_health)}/100.</p>}
      <div style={{ height: 300, margin: '22px 0' }}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.chart_data} margin={{ top: 12, right: 25, bottom: 10, left: 0 }}>
        <CartesianGrid stroke={border} strokeDasharray="3 3" />
        <XAxis dataKey="day" type="number" scale="linear" domain={[0, chartMaxDay]} ticks={chartTicks} allowDecimals={false} tick={{ fill: muted, fontSize: 12 }} label={{ value: 'Days after inspection', position: 'insideBottom', offset: -5, fill: muted }} />
        <YAxis domain={[0, 100]} tick={{ fill: muted, fontSize: 12 }} />
        <Tooltip formatter={value => value == null ? 'Unavailable' : num(value) + ' / 100'} />
        <Legend verticalAlign="top" />
        <ReferenceLine y={boundary} stroke={tone.Critical.color} strokeDasharray="5 4" label={{ value: 'Failure boundary (' + boundary + ')', fill: tone.Critical.color, fontSize: 11 }} />
        <Line type="linear" dataKey="without_repair" name="Without repair" stroke={ink} strokeWidth={2} dot={false} connectNulls={false} />
        <Line type="linear" dataKey="with_repair" name="With assumed repair" stroke={teal} strokeWidth={2} dot={false} connectNulls={false} />
      </LineChart></ResponsiveContainer></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['Repair day', 'Time after repair', 'Total from inspection', 'Additional days gained', 'Boundary date'].map(label => <th key={label} style={cell}>{label}</th>)}</tr></thead>
        <tbody>{result.comparison.map(row => <tr key={row.repair_day} style={{ background: row.repair_day === repairDay ? '#EAF4F0' : '#fff' }}>
          <td style={cell}>{row.repair_day}</td><td style={cell}>{row.available ? dayText(row.days_after_repair) : 'Unavailable'}</td>
          <td style={cell}>{row.available ? dayText(row.total_days_from_today) : 'Unavailable'}</td>
          <td style={cell}>{row.available ? dayText(row.additional_days_gained) : 'Unavailable'}</td>
          <td style={cell} title={row.reason || ''}>{row.available ? dateText(row.repaired_failure_date) : 'Unavailable'}</td>
        </tr>)}</tbody>
      </table></div>
      <p style={note}>Whole days round up to the first projected day at or below the boundary. {result.estimate_note}</p>
    </>}
  </Section>;
}
export default function SurvivalAnalysis() {
  const navigate = useNavigate();
  const [bridges, setBridges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [search, setSearch] = useState('');
  const [topTen, setTopTen] = useState(true);
  const [revision, setRevision] = useState(0);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [networkError, setNetworkError] = useState('');
  const [detailError, setDetailError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/survival/all', { signal: controller.signal })
      .then(data => {
        const list = data.bridges || [];
        setBridges(list);
        if (list.length) setDetailLoading(true);
        setSelectedId(current => current ?? list[0]?.bridge_id ?? null);
      })
      .catch(err => { if (err.name !== 'AbortError') setNetworkError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setNetworkLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (selectedId == null) return undefined;
    const controller = new AbortController();
    apiFetch('/api/survival/predict?bridge_id=' + selectedId, { signal: controller.signal })
      .then(setReport).catch(err => { if (err.name !== 'AbortError') setDetailError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision]);
  const displayed = useMemo(() => {
    const list = bridges.filter(bridge => bridge.bridge_name.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => (a.days_to_critical ?? Infinity) - (b.days_to_critical ?? Infinity));
    return topTen ? list.slice(0, 10) : list;
  }, [bridges, search, topTen]);
  const priorityCounts = useMemo(() => bridges.reduce((counts, bridge) => {
    if (Object.hasOwn(counts, bridge.urgency)) counts[bridge.urgency] += 1;
    return counts;
  }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }), [bridges]);
  const bounds = report?.health_boundaries;
  const pred = report?.survival_predictions;
  const dates = report?.forecast_dates;
  const factors = report?.degradation_breakdown;
  return <main style={{ fontFamily: 'var(--font-family)', color: ink, padding: '24px clamp(16px, 3vw, 36px)', maxWidth: 1500, margin: '0 auto' }}>
    <div style={{ ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div><h1 style={{ margin: '0 0 5px', fontSize: 27, color: ink }}>Predictive maintenance</h1><p style={{ ...note, margin: 0, color: '#475569' }}>Simulated health forecasts from current readings and project thresholds.</p></div>
      <button type="button" onClick={() => { setNetworkLoading(true); setNetworkError(''); setDetailLoading(selectedId != null); setDetailError(''); setReport(null); setRevision(value => value + 1); }} style={{ background: teal, border: '1px solid ' + teal, borderRadius: 7, padding: '9px 12px', color: '#fff', cursor: 'pointer', display: 'flex', gap: 7, alignItems: 'center', font: 'inherit' }}><RefreshCw size={15} /> Refresh</button>
    </div>
    {networkError && <p role="alert" style={{ color: tone.Critical.color }}>{networkError}</p>}
    <div style={{ ...grid, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 16 }}>
      {priorityCards.map(priority => <div key={priority.key} style={{ ...panel, padding: '12px 15px', minWidth: 0 }}>
        <div style={{ ...note, color: priority.color, fontWeight: 600 }}>{priority.label} priority</div>
        <div style={{ color: ink, fontSize: 22, fontWeight: 700, marginTop: 3 }}>{networkLoading ? '—' : priorityCounts[priority.key]}</div>
      </div>)}
    </div>
    <Section title="Network priorities">
      <p style={note}>Sorted by simulated time to the critical health boundary.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Search size={15} color={muted} /><input aria-label="Search bridges" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search bridges" style={{ border: '1px solid ' + border, borderRadius: 6, padding: 7, font: 'inherit' }} /></label>
        <label><input type="checkbox" checked={topTen} onChange={event => setTopTen(event.target.checked)} style={{ accentColor: teal }} /> Top 10 only</label>
      </div>
      {networkLoading ? <p style={note}>Loading network forecasts…</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['Bridge', 'Location', 'Health', 'Condition', 'Critical boundary', 'Failure boundary', 'Urgency', ''].map(label => <th key={label} style={{ ...cell, color: muted }}>{label}</th>)}</tr></thead>
        <tbody>{displayed.map(bridge => <tr key={bridge.bridge_id} style={{ background: bridge.bridge_id === selectedId ? '#F3F8F6' : '#fff' }}>
          <td style={cell}>{bridge.bridge_name}</td><td style={cell}>{bridge.location}</td><td style={cell}>{num(bridge.health_score)}</td>
          <td style={cell}><Badge value={bridge.health_condition} /></td><td style={cell}>{dayText(bridge.days_to_critical)}</td>
          <td style={cell}>{dayText(bridge.days_to_failure)}</td><td style={cell}><Badge value={bridge.urgency} /></td>
          <td style={cell}><button type="button" disabled={bridge.bridge_id === selectedId} onClick={() => { setReport(null); setDetailError(''); setDetailLoading(true); setSelectedId(bridge.bridge_id); }} style={{ border: '1px solid ' + border, color: bridge.bridge_id === selectedId ? muted : teal, background: '#fff', borderRadius: 6, padding: '5px 9px', cursor: bridge.bridge_id === selectedId ? 'default' : 'pointer' }}>{bridge.bridge_id === selectedId ? 'Selected' : 'Analyze'}</button></td>
        </tr>)}</tbody>
      </table>{!displayed.length && <p style={note}>No bridges match this search.</p>}</div>}
    </Section>
    {detailError && <p role="alert" style={{ color: tone.Critical.color }}>{detailError}</p>}
    {detailLoading && <p style={note}>Loading bridge forecast…</p>}
    {report && <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
      <Section title={report.bridge_name}>
        <p style={{ ...note, margin: 0, display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>Inspection date: {dateText(report.analysis_date)} · Health: {num(report.health_score)}/100 <span>Condition: <Badge value={report.health_condition} /></span><span>Urgency: <Badge value={report.urgency} /></span></p>
        <p style={note}>{report.estimate_note}</p>
        <p style={{ ...note, marginBottom: 0 }}>Condition and urgency include project sensor threshold breaches; forecast dates use health-score boundaries.</p>
      </Section>
      <div style={grid}>{[
        ['Monitor', pred?.days_to_warning, dates?.days_to_warning, bounds?.monitor],
        ['Critical', pred?.days_to_critical, dates?.days_to_critical, bounds?.critical],
        ['Failure', pred?.days_to_failure, dates?.days_to_failure, bounds?.failure],
      ].map(([label, value, forecastDate, boundary]) => <div key={label} style={panel}><div style={note}>{label} · {boundary}-point boundary</div><strong style={{ display: 'block', fontSize: 23, margin: '7px 0' }}>{dayText(value)}</strong><div style={note}>{dateText(forecastDate)}</div></div>)}</div>
      <Section title="Degradation rate">
        <strong style={{ fontSize: 21 }}>{factors?.daily_degradation_rate == null ? 'Unavailable' : num(factors.daily_degradation_rate, 3) + ' points/day'}</strong>
        <p style={note}>Simulated rate = maximum of multiplied rate and condition floor. Sensor factor uses the highest structural reading relative to its project critical threshold, not hardware wear.</p>
        {factors?.daily_degradation_rate != null && <div style={grid}>{[
          ['Base rate from health band', num(factors.base_rate, 3) + ' points/day'],
          ['Anomaly factor', num(factors.anomaly_multiplier, 3) + '×' + (factors.anomaly_available ? '' : ' (data unavailable; neutral)')],
          ['Risk factor', num(factors.risk_multiplier, 3) + '×' + (factors.risk_available ? '' : ' (data unavailable; neutral)')],
          ['Sensor threshold factor', num(factors.sensor_multiplier, 3) + '×' + (factors.sensor_available ? '' : ' (data unavailable; neutral)')],
          ['Condition floor', num(factors.minimum_rate, 3) + ' points/day'],
          ['Multiplied rate before floor', num(factors.raw_rate, 3) + ' points/day'],
        ].map(([label, value]) => <div key={label} style={{ borderTop: '1px solid ' + border, paddingTop: 8 }}><div style={note}>{label}</div><strong>{value}</strong></div>)}</div>}
      </Section>
      <Section title="Reading / critical threshold">
        <p style={note}>Structural measurements against project sensor thresholds; they do not indicate sensor hardware failure.</p>
        <div style={grid}>{(report.sensor_readings || []).map(item => <div key={item.key} style={{ ...panel, padding: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{item.condition === 'Critical' ? <AlertTriangle size={16} color={tone.Critical.color} /> : item.condition === 'Healthy' ? <CheckCircle2 size={16} color={teal} /> : <Activity size={16} color={muted} />}<strong>{item.sensor}</strong></div>
          <p style={{ margin: '10px 0 5px' }}>{item.reading == null ? 'Unavailable' : item.reading + ' ' + item.unit} / {item.critical_threshold} {item.unit}</p>
          <span style={note}>{item.ratio_pct == null ? 'Ratio unavailable' : item.ratio_pct + '% of critical threshold'} · <Badge value={item.condition} /></span>
        </div>)}</div>
      </Section>
      <div><h2 style={{ fontSize: 19, margin: '0 0 5px' }}>Maintenance schedule</h2><p style={note}>Suggested review actions; a qualified inspection determines actual work.</p>
        <div style={grid}><Schedule title="Immediate actions" actions={report.maintenance_schedule?.immediate} /><Schedule title="Scheduled maintenance" actions={report.maintenance_schedule?.scheduled} /><Schedule title="Long-term monitoring" actions={report.maintenance_schedule?.long_term} /></div>
      </div>
      <RepairSimulator key={report.bridge_id + ':' + report.analysis_date + ':' + report.health_score} report={report} />
      <button type="button" onClick={() => navigate('/maintenance')} style={{ justifySelf: 'start', color: '#fff', background: teal, border: '1px solid ' + teal, borderRadius: 7, padding: '9px 13px', cursor: 'pointer' }}>Open maintenance planning</button>
    </div>}
    {!report && !detailLoading && !detailError && !networkLoading && <p style={note}>Select a bridge to view its simulated forecast.</p>}
    <footer style={{ ...note, marginTop: 24 }}>Forecasts are simulated estimates, not engineering findings.</footer>
  </main>;
}
