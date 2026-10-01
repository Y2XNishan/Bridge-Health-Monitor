import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Camera, CheckCircle2, MapPin, Ruler, Upload } from 'lucide-react';
import { useAuth } from '../context/authContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ink = '#1C1F26';
const teal = '#0F6E56';
const muted = '#64748B';
const border = '#E2E8F0';
const panel = { background: '#fff', border: '1px solid ' + border, borderRadius: 10, padding: 18 };
const small = { color: muted, fontSize: 13 };
const tones = {
  Healthy: { color: teal, background: '#EAF4F0' },
  Monitor: { color: '#8A641B', background: '#F8F2E6' },
  Critical: { color: '#9B4242', background: '#F9EEEE' },
  Unavailable: { color: muted, background: '#F1F5F9' },
};
const visualTones = {
  hairline: tones.Healthy, minor: tones.Healthy, moderate: tones.Monitor,
  severe: tones.Critical, critical: tones.Critical,
};
const inputStyle = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid ' + border, borderRadius: 6, padding: '9px 11px', color: ink, font: 'inherit' };

function StatusPill({ status }) {
  const style = tones[status] || tones.Unavailable;
  return <span style={{ ...style, display: 'inline-block', borderRadius: 5, padding: '4px 8px', fontSize: 12, fontWeight: 650 }}>{status || 'Unavailable'}</span>;
}
function Detail({ label, value, note }) {
  return <div style={{ border: '1px solid ' + border, borderRadius: 7, padding: 12, minWidth: 0 }}>
    <div style={small}>{label}</div>
    <div style={{ color: ink, fontWeight: 650, marginTop: 4, overflowWrap: 'anywhere', textTransform: 'none' }}>{value ?? 'Unavailable'}</div>
    {note && <div style={{ ...small, marginTop: 5 }}>{note}</div>}
  </div>;
}
function cleanLabel(value) {
  if (!value) return 'Unavailable';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CrackDetection() {
  const { token } = useAuth();
  const authToken = token || localStorage.getItem('bridgeiq_token') || '';
  const [bridges, setBridges] = useState([]);
  const [bridgeId, setBridgeId] = useState('');
  const [bridgeLoading, setBridgeLoading] = useState(true);
  const [bridgeError, setBridgeError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [calibratedWidth, setCalibratedWidth] = useState('');
  const [measurementReference, setMeasurementReference] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const requestRef = useRef(null);
  const previewRef = useRef(null);
  const selectedBridge = bridges.find(bridge => bridge.id === Number(bridgeId));
  const measurementIncomplete = Boolean(calibratedWidth || measurementReference.trim()) && (!calibratedWidth || !measurementReference.trim());

  useEffect(() => {
    const controller = new AbortController();
    fetch(API + '/api/crack-detection/bridges', {
      signal: controller.signal,
      headers: { Authorization: 'Bearer ' + authToken },
    }).then(async response => {
      if (!response.ok) throw new Error('Bridge list unavailable (' + response.status + ').');
      return response.json();
    }).then(list => {
      requestRef.current?.abort();
      requestRef.current = null;
      setLoading(false);
      setResult(null);
      setBridges(list);
      setBridgeId(current => list.some(bridge => String(bridge.id) === current) ? current : String(list[0]?.id || ''));
      setBridgeLoading(false);
    }).catch(failure => {
      if (failure.name !== 'AbortError') { setBridgeError(failure.message); setBridgeLoading(false); }
    });
    return () => controller.abort();
  }, [authToken]);
  useEffect(() => () => {
    requestRef.current?.abort();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const clearAnalysis = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setResult(null);
    setError('');
  };
  const handleFileSelect = file => {
    clearAnalysis();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setSelectedFile(null);
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Choose an image file smaller than 10 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    setSelectedFile(file);
  };
  const handleAnalyze = async () => {
    if (!selectedFile || !selectedBridge || measurementIncomplete) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setLoading(true);
    setResult(null);
    setError('');
    const params = new URLSearchParams({
      bridge_id: String(selectedBridge.id),
      bridge_name: selectedBridge.name,
    });
    if (calibratedWidth !== '') {
      params.set('calibrated_width_mm', calibratedWidth);
      params.set('measurement_reference', measurementReference.trim());
    }
    const form = new FormData();
    form.append('file', selectedFile);
    try {
      const response = await fetch(API + '/api/crack-detection?' + params.toString(), {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: 'Bearer ' + authToken },
        body: form,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.detail === 'string' ? body.detail : 'Image analysis failed (' + response.status + ').');
      }
      const data = await response.json();
      if (requestRef.current === controller) setResult(data);
    } catch (failure) {
      if (failure.name !== 'AbortError' && requestRef.current === controller) setError(failure.message);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
    }
  };

  const visualLabel = result?.analysis_status === 'unavailable'
    ? 'Unavailable'
    : result?.crack_detected === false ? 'No crack identified' : cleanLabel(result?.visual_severity);
  const visualStyle = visualTones[result?.visual_severity] || tones.Unavailable;
  const VisualIcon = result?.crack_detected === false ? CheckCircle2 : result?.crack_detected ? AlertTriangle : AlertCircle;
  return <main style={{ fontFamily: 'var(--font-family)', color: ink, textTransform: 'none', padding: '24px clamp(16px, 3vw, 36px)', maxWidth: 1200, margin: '0 auto' }}>
    <div style={{ ...panel, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 11 }}>
      <Camera size={21} color={teal} />
      <div><h1 style={{ color: ink, fontSize: 23, margin: '0 0 4px' }}>AI crack detection</h1>
        <p style={{ ...small, margin: 0 }}>Visual estimates require on-site verification. Physical dimensions need a calibrated measurement reference.</p></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <section style={panel}>
          <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Bridge information</h2>
          <label htmlFor="crack-bridge" style={small}>Bridge</label>
          <select id="crack-bridge" value={bridgeId} disabled={bridgeLoading || !bridges.length} onChange={event => { clearAnalysis(); setBridgeId(event.target.value); }} style={{ ...inputStyle, marginTop: 5 }}>
            {bridges.length ? bridges.map(bridge => <option key={bridge.id} value={bridge.id}>{bridge.name} (ID {bridge.id})</option>) : <option value="">No bridges available</option>}
          </select>
          {bridgeLoading && <p style={small}>Loading bridge list…</p>}
          {bridgeError && <p role="alert" style={{ color: tones.Critical.color }}>{bridgeError}</p>}
          {selectedBridge && <p style={{ ...small, marginBottom: 0 }}>Selected ID: {selectedBridge.id} · {selectedBridge.name}</p>}
        </section>
        <section style={panel}>
          <h2 style={{ fontSize: 17, margin: '0 0 7px' }}>Upload image</h2>
          <p style={{ ...small, marginTop: 0 }}>JPG, PNG or WEBP; maximum 10 MB.</p>
          <div role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click(); } }}
            onDrop={event => { event.preventDefault(); handleFileSelect(event.dataTransfer.files[0]); }}
            onDragOver={event => event.preventDefault()} onClick={() => fileInputRef.current?.click()}
            style={{ border: '1px dashed ' + (preview ? teal : border), borderRadius: 8, background: '#F8FAFC', padding: 18, textAlign: 'center', cursor: 'pointer' }}>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => { handleFileSelect(event.target.files[0]); event.target.value = ''; }} />
            {preview ? <img src={preview} alt="Selected bridge photo preview" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 300, objectFit: 'contain' }} /> : <><Upload size={28} color={muted} /><p style={{ ...small, marginBottom: 0 }}>Drop an image here or choose a file</p></>}
          </div>
          {selectedFile && <p style={{ ...small, marginBottom: 0 }}>{selectedFile.name}</p>}
        </section>
        <section style={panel}>
          <h2 style={{ fontSize: 17, margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 7 }}><Ruler size={17} color={teal} /> Optional calibrated width</h2>
          <p style={{ ...small, marginTop: 0 }}>Enter a field-measured crack width and its reference. The image model does not measure mm.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={small}>Measured width (mm)
              <input type="number" min="0" step="any" value={calibratedWidth} onChange={event => { clearAnalysis(); setCalibratedWidth(event.target.value); }} placeholder="Unavailable" style={{ ...inputStyle, marginTop: 5, textTransform: 'none' }} />
            </label>
            <label style={small}>Measurement reference
              <input type="text" value={measurementReference} onChange={event => { clearAnalysis(); setMeasurementReference(event.target.value); }} placeholder="For example, field crack gauge" style={{ ...inputStyle, marginTop: 5 }} />
            </label>
          </div>
          {measurementIncomplete && <p role="alert" style={{ color: tones.Monitor.color, fontSize: 12 }}>Provide both the measured width and its reference, or leave both blank.</p>}
        </section>
        {error && <p role="alert" style={{ ...panel, color: tones.Critical.color, display: 'flex', gap: 8, alignItems: 'center' }}><AlertCircle size={17} /> {error}</p>}
        <button type="button" onClick={handleAnalyze} disabled={!selectedFile || !selectedBridge || loading || measurementIncomplete}
          style={{ background: !selectedFile || !selectedBridge || loading || measurementIncomplete ? '#E2E8F0' : teal, color: !selectedFile || !selectedBridge || loading || measurementIncomplete ? muted : '#fff', border: '1px solid ' + border, borderRadius: 7, padding: '11px 15px', font: 'inherit', fontWeight: 650, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Analyzing image…' : 'Analyze image'}
        </button>
      </div>
      {result && <div style={{ display: 'grid', gap: 16 }}>
        <section style={panel}>
          <h2 style={{ fontSize: 18, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}><VisualIcon size={18} color={visualStyle.color} /> Visual assessment</h2>
          <p style={{ ...small, marginTop: 0 }}>{result.visual_source}</p>
          {result.analysis_status === 'unavailable' && <p role="alert" style={{ color: tones.Critical.color, background: tones.Critical.background, borderRadius: 6, padding: 10, fontSize: 13 }}>
            {result.error_message || 'Vision analysis is unavailable. Try again later.'} {result.error_category && <span>({result.error_category})</span>}
          </p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Detail label="Model-estimated visual severity" value={visualLabel} />
            <Detail label="Project threshold status" value={<StatusPill status={result.threshold_status} />} note={'Critical at or above ' + result.critical_threshold_mm + ' mm when width is calibrated.'} />
            <Detail label="Calibrated width" value={result.calibrated_width_mm == null ? 'Unavailable' : result.calibrated_width_mm + ' mm'} note={result.width_source} />
            <Detail label="Physical length" value="Unavailable" note={result.length_source} />
            <Detail label="Model confidence" value="Unavailable" note={result.confidence_source} />
            <Detail label="Model-estimated crack count" value={result.crack_count ?? 'Unavailable'} />
            <Detail label="Model-estimated crack type" value={cleanLabel(result.crack_type)} />
            <Detail label="Model-estimated material" value={cleanLabel(result.material)} />
          </div>
          {result.crack_detected === false && <p style={{ ...small, marginBottom: 0 }}>No crack identified in the image; this is not a field inspection finding.</p>}
          <div style={{ borderTop: '1px solid ' + border, marginTop: 14, paddingTop: 12 }}>
            <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} color={teal} /> Recommended next step</strong>
            <p style={{ ...small, marginBottom: 0 }}>{result.recommended_action}</p>
          </div>
        </section>
        <figure style={{ ...panel, margin: 0 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 11px' }}>{result.regions?.length ? 'Image with model-estimated crack region' : 'Uploaded image'}</h2>
          <img src={'data:image/jpeg;base64,' + result.annotated_image_base64} alt={result.regions?.length ? 'Bridge image with model-estimated crack region outlined' : 'Full uploaded bridge image without localization'} style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 6 }} />
          <figcaption style={{ ...small, marginTop: 10, lineHeight: 1.5 }}>{result.annotation_caption}</figcaption>
        </figure>
      </div>}
    </div>
  </main>;
}
