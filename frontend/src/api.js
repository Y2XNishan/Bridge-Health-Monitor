const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper to automatically attach token
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('bridgeiq_token');
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}

export async function fetchBridges() {
  const res = await apiFetch(`${API_BASE}/api/bridges`);
  if (!res.ok) throw new Error(`/api/bridges ${res.status}`);
  return res.json();
}

export async function fetchLive(bridgeId = 1) {
  const res = await apiFetch(`${API_BASE}/api/live?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/live ${res.status}`);
  return res.json();
}

export async function fetchAlerts(bridgeId = 1) {
  const res = await apiFetch(`${API_BASE}/api/alerts?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/alerts ${res.status}`);
  return res.json();
}

export async function fetchHistory(bridgeId = 1) {
  const res = await apiFetch(`${API_BASE}/api/history?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/history ${res.status}`);
  return res.json();
}

export async function fetchAnomaly(bridgeId = 1) {
  const res = await apiFetch(`${API_BASE}/api/anomaly?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/anomaly ${res.status}`);
  return res.json();
}

export async function fetchPredict(bridgeId = 1) {
  const res = await apiFetch(`${API_BASE}/api/predict?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/predict ${res.status}`);
  return res.json();
}

export async function fetchHealthHistory(bridgeId = 1) {
  const res = await apiFetch(`${API_BASE}/api/health/history?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/health/history ${res.status}`);
  return res.json();
}

export async function fetchMaintenanceAssignments() {
  const res = await apiFetch(`${API_BASE}/api/maintenance/assignments`);
  if (!res.ok) throw await maintenanceError(res, 'Load assignments');
  return res.json();
}

export async function fetchMaintenanceBridges() {
  const res = await apiFetch(`${API_BASE}/api/maintenance/bridges`);
  if (!res.ok) throw await maintenanceError(res, 'Load bridges');
  return res.json();
}

async function maintenanceError(res, action) {
  const body = await res.json().catch(() => null);
  const detail = body?.detail || body?.error;
  const message = Array.isArray(detail)
    ? detail.map((item) => `${item.loc?.at(-1) || 'Field'}: ${item.msg}`).join('; ')
    : typeof detail === 'string' ? detail : `Request failed (${res.status})`;
  return new Error(`${action}: ${message}`);
}

export async function createMaintenanceAssignment(payload) {
  const res = await apiFetch(`${API_BASE}/api/maintenance/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await maintenanceError(res, 'Create assignment');
  return res.json();
}

export async function updateMaintenanceAssignment(assignmentId, payload) {
  const res = await apiFetch(`${API_BASE}/api/maintenance/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await maintenanceError(res, 'Update assignment');
  return res.json();
}

export async function deleteMaintenanceAssignment(assignmentId) {
  const res = await apiFetch(`${API_BASE}/api/maintenance/assignments/${assignmentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await maintenanceError(res, 'Delete assignment');
  return res.json();
}

export async function fetchMaintenanceEngineers() {
  const res = await apiFetch(`${API_BASE}/api/maintenance/engineers`);
  if (!res.ok) throw await maintenanceError(res, 'Load engineers');
  return res.json();
}

export async function downloadReport(bridgeId, bridgeName) {
  const token = localStorage.getItem('bridgeiq_token');
  const urlWithToken = `${API_BASE}/api/report?bridge_id=${bridgeId}${token ? `&token=${token}` : ''}`;
  
  const res = await apiFetch(urlWithToken);
  if (!res.ok) throw new Error(`/api/report ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `Bridge_Health_Monitor_Report_${bridgeName}_${date}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function runAgentInspect(bridgeId, bridgeName) {
  const res = await apiFetch(`${API_BASE}/api/agent/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridge_id: bridgeId, bridge_name: bridgeName }),
  });
  if (!res.ok) throw new Error(`/api/agent/inspect ${res.status}`);
  return res.json();
}

export async function downloadAgentInspectPDF(inspectionResult) {
  const res = await apiFetch(`${API_BASE}/api/agent/inspect/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bridge_id: inspectionResult.bridge_id,
      bridge_name: inspectionResult.bridge_name,
      severity: inspectionResult.severity,
      health_score: inspectionResult.health_score,
      alert_level: inspectionResult.alert_level,
      sensor_summary: inspectionResult.sensor_summary,
      issues_detected: inspectionResult.issues_detected,
      recommendations: inspectionResult.recommendations,
      full_report: inspectionResult.full_report
    }),
  });
  if (!res.ok) throw new Error(`/api/agent/inspect/pdf ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `AI_Inspection_Report_${inspectionResult.bridge_name}_${date}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchXaiExplanation(bridgeId) {
  const res = await apiFetch(`${API_BASE}/api/xai/explain?bridge_id=${bridgeId}`);
  if (!res.ok) throw new Error(`/api/xai/explain ${res.status}`);
  return res.json();
}
