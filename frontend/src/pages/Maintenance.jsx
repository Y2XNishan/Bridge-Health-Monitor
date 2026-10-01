import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/authContext';
import {
  createMaintenanceAssignment,
  deleteMaintenanceAssignment,
  fetchMaintenanceAssignments,
  fetchMaintenanceBridges,
  fetchMaintenanceEngineers,
  updateMaintenanceAssignment,
} from '../api';

const ink = '#1C1F26';
const teal = '#0F6E56';
const muted = '#65717B';
const border = '#DDE3E5';
const taskLabels = {
  ROUTINE_INSPECTION: 'Routine inspection',
  CRACK_REPAIR: 'Crack repair',
  SENSOR_REPLACEMENT: 'Sensor replacement',
  STRUCTURAL_REPAIR: 'Structural repair',
  EMERGENCY_RESPONSE: 'Emergency response',
  LOAD_TESTING: 'Load testing',
};
const priorityLabels = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
const statusLabels = { PENDING: 'Pending', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const transitions = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
const priorityTones = {
  LOW: { color: teal, background: '#EAF4F0' },
  MEDIUM: { color: '#8A6B32', background: '#F8F3E9' },
  HIGH: { color: '#9C673D', background: '#FBF1E8' },
  CRITICAL: { color: '#9B4242', background: '#F9EEEE' },
};
const statusTones = {
  PENDING: { color: muted, background: '#F3F5F5' },
  IN_PROGRESS: { color: '#8A6B32', background: '#F8F3E9' },
  COMPLETED: { color: teal, background: '#EAF4F0' },
  CANCELLED: { color: '#9B4242', background: '#F9EEEE' },
};
const emptyForm = { bridge_id: '', assigned_to_id: '', task_type: 'ROUTINE_INSPECTION', priority: 'MEDIUM', due_date: '', description: '' };
const card = { background: '#fff', border: `1px solid ${border}`, borderRadius: 8 };
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', color: ink, background: '#fff', border: `1px solid ${border}`, borderRadius: 6, font: 'inherit', fontSize: 14 };
const action = { border: `1px solid ${teal}`, borderRadius: 6, background: teal, color: '#fff', font: 'inherit', fontWeight: 650, padding: '10px 15px', cursor: 'pointer' };
const secondaryAction = { ...action, background: '#fff', color: ink, borderColor: border };

function Badge({ value, labels, tones }) {
  const tone = tones[value] || { color: muted, background: '#F3F5F5' };
  return <span style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 5, color: tone.color, background: tone.background, fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap', textTransform: 'none' }}>{labels[value] || value || 'Unavailable'}</span>;
}

function Field({ label, children }) {
  return <label style={{ display: 'block', minWidth: 0, color: ink, fontSize: 13, fontWeight: 600 }}><span style={{ display: 'block', marginBottom: 6 }}>{label}</span>{children}</label>;
}

function validateForm(form, bridges, engineers) {
  if (!bridges.some((bridge) => bridge.id === Number(form.bridge_id))) return 'Select a valid bridge.';
  if (!engineers.some((engineer) => engineer.id === Number(form.assigned_to_id))) return 'Select a valid engineer.';
  if (!Object.hasOwn(taskLabels, form.task_type)) return 'Select a valid task type.';
  if (!Object.hasOwn(priorityLabels, form.priority)) return 'Select a valid priority.';
  if (!form.description.trim()) return 'Enter a description.';
  const parsedDate = new Date(`${form.due_date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.due_date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== form.due_date) return 'Select a valid due date.';
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  if (form.due_date < today) return 'Due date cannot be in the past.';
  return '';
}

export default function Maintenance() {
  const { user } = useAuth();
  const role = user?.role;
  const admin = role === 'admin';
  const engineer = role === 'engineer';
  const location = useLocation();
  const preselectionHandled = useRef(null);
  const submitLock = useRef(false);
  const [assignments, setAssignments] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [modalError, setModalError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notesById, setNotesById] = useState({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [assignmentData, bridgeData, engineerData] = await Promise.all([
        fetchMaintenanceAssignments(), fetchMaintenanceBridges(), admin ? fetchMaintenanceEngineers() : Promise.resolve([]),
      ]);
      setAssignments(assignmentData);
      setBridges(bridgeData);
      setEngineers(engineerData);
      const selected = location.state?.preselectedBridge;
      if (admin && selected && preselectionHandled.current !== location.key) {
        preselectionHandled.current = location.key;
        if (bridgeData.some((bridge) => bridge.id === Number(selected.id))) {
          setForm({ ...emptyForm, bridge_id: String(selected.id) });
          setIsModalOpen(true);
        }
      }
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [admin, location.key, location.state]);

  useEffect(() => { Promise.resolve().then(loadData); }, [loadData]);

  const counts = useMemo(() => assignments.reduce((acc, assignment) => {
    if (Object.hasOwn(acc, assignment.status)) acc[assignment.status] += 1;
    return acc;
  }, { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }), [assignments]);

  function openModal() {
    setForm({ ...emptyForm, bridge_id: bridges.length ? String(bridges[0].id) : '' });
    setModalError('');
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setModalError('');
  }

  async function refreshAssignments() {
    try {
      setAssignments(await fetchMaintenanceAssignments());
    } catch (error) {
      setActionError(`Saved, but the assignment list could not be refreshed. ${error.message}`);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (submitLock.current) return;
    const validation = validateForm(form, bridges, engineers);
    if (validation) { setModalError(validation); return; }
    submitLock.current = true;
    setIsSubmitting(true);
    setModalError('');
    setActionError('');
    try {
      const saved = await createMaintenanceAssignment({
        bridge_id: Number(form.bridge_id), assigned_to_id: Number(form.assigned_to_id),
        task_type: form.task_type, priority: form.priority,
        description: form.description.trim(), due_date: form.due_date,
      });
      setAssignments((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      setIsModalOpen(false);
      await refreshAssignments();
    } catch (error) {
      setModalError(error.message);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(assignment, nextStatus) {
    if (busyId !== null || !transitions[assignment.status]?.includes(nextStatus)) return;
    setBusyId(assignment.id);
    setActionError('');
    try {
      const updated = await updateMaintenanceAssignment(assignment.id, { status: nextStatus, ...(nextStatus === 'COMPLETED' ? { notes: notesById[assignment.id] || '' } : {}) });
      setAssignments((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      setNotesById((previous) => ({ ...previous, [assignment.id]: '' }));
      await refreshAssignments();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(assignmentId) {
    if (busyId !== null) return;
    setBusyId(assignmentId);
    setActionError('');
    try {
      await deleteMaintenanceAssignment(assignmentId);
      setAssignments((previous) => previous.filter((item) => item.id !== assignmentId));
      await refreshAssignments();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  return <main style={{ fontFamily: 'var(--font-family, sans-serif)', color: ink, textTransform: 'none', display: 'grid', gap: 14 }}>
    <section aria-labelledby="maintenance-title" style={{ ...card, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
      <div><h1 id="maintenance-title" style={{ margin: 0, color: ink, fontSize: 23, fontWeight: 700 }}>{admin ? 'Crew assignments' : engineer ? 'My assignments' : 'Assignments'}</h1><p style={{ margin: '4px 0 0', color: muted, fontSize: 13 }}>Signed in as {user?.name || 'Unknown user'} · {role || 'Unknown role'}</p></div>
      {admin && <button type="button" onClick={openModal} disabled={isLoading || Boolean(loadError)} style={{ ...action, marginLeft: 'auto', opacity: isLoading || loadError ? 0.6 : 1 }}>New assignment</button>}
    </section>

    {isLoading && <p role="status" style={{ ...card, margin: 0, padding: 16, color: muted }}>Loading assignments…</p>}
    {loadError && <div role="alert" style={{ ...card, padding: 16, color: '#9B4242' }}>{loadError} <button type="button" onClick={loadData} style={{ ...secondaryAction, marginLeft: 10 }}>Retry</button></div>}
    {actionError && <p role="alert" style={{ ...card, margin: 0, padding: 14, color: '#9B4242' }}>{actionError}</p>}

    {!isLoading && !loadError && <>
      {admin && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12 }}>
        {[['Pending', counts.PENDING], ['In progress', counts.IN_PROGRESS], ['Completed', counts.COMPLETED], ['Cancelled', counts.CANCELLED], ['Total', assignments.length]].map(([label, value]) =>
          <div key={label} style={{ ...card, padding: 16 }}><div style={{ color: muted, fontSize: 13 }}>{label}</div><strong style={{ display: 'block', marginTop: 8, fontSize: 25 }}>{value}</strong></div>)}
      </div>}

      {admin ? <div style={{ ...card, overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860, fontSize: 13 }}>
        <thead><tr>{['Bridge', 'Assigned to', 'Task type', 'Priority', 'Status', 'Due date', 'Actions'].map((heading) => <th key={heading} style={{ padding: 12, textAlign: 'left', borderBottom: `1px solid ${border}`, color: muted, fontWeight: 600 }}>{heading}</th>)}</tr></thead>
        <tbody>{assignments.map((assignment) => <tr key={assignment.id}>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{assignment.bridge_name}</td>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{assignment.assigned_to_name}</td>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{taskLabels[assignment.task_type] || assignment.task_type}</td>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}><Badge value={assignment.priority} labels={priorityLabels} tones={priorityTones} /></td>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}><select aria-label={`Status for ${assignment.bridge_name}`} value={assignment.status} disabled={busyId !== null || !transitions[assignment.status]?.length} onChange={(event) => handleStatusChange(assignment, event.target.value)} style={{ ...input, minWidth: 130, padding: 7 }}><option value={assignment.status}>{statusLabels[assignment.status] || assignment.status}</option>{transitions[assignment.status]?.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></td>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{assignment.due_date || 'Unavailable'}</td>
          <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}><button type="button" onClick={() => handleDelete(assignment.id)} disabled={busyId !== null} style={{ ...secondaryAction, padding: '7px 10px', color: '#9B4242' }}>Delete</button></td>
        </tr>)}</tbody>
      </table>{assignments.length === 0 && <p style={{ margin: 0, padding: 22, textAlign: 'center', color: muted }}>No assignments yet.</p>}</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))', gap: 14 }}>
        {assignments.map((assignment) => <article key={assignment.id} style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}><div><h2 style={{ margin: 0, fontSize: 17 }}>{assignment.bridge_name}</h2><p style={{ margin: '5px 0 0', color: muted, fontSize: 13 }}>{taskLabels[assignment.task_type] || assignment.task_type}</p></div><Badge value={assignment.priority} labels={priorityLabels} tones={priorityTones} /></div>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>{assignment.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}><Badge value={assignment.status} labels={statusLabels} tones={statusTones} /><span style={{ color: muted, fontSize: 13 }}>Due: {assignment.due_date || 'Unavailable'}</span></div>
          {engineer && assignment.status === 'PENDING' && <button type="button" disabled={busyId !== null} onClick={() => handleStatusChange(assignment, 'IN_PROGRESS')} style={{ ...action, marginTop: 15 }}>Start task</button>}
          {engineer && assignment.status === 'IN_PROGRESS' && <div style={{ marginTop: 15 }}><label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Completion notes</label><textarea value={notesById[assignment.id] || ''} onChange={(event) => setNotesById((previous) => ({ ...previous, [assignment.id]: event.target.value }))} style={{ ...input, minHeight: 76 }} /><button type="button" disabled={busyId !== null} onClick={() => handleStatusChange(assignment, 'COMPLETED')} style={{ ...action, marginTop: 10 }}>Complete task</button></div>}
        </article>)}
        {assignments.length === 0 && <p style={{ ...card, margin: 0, padding: 22, color: muted }}>No assignments yet.</p>}
      </div>}
    </>}

    {admin && isModalOpen && <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(28,31,38,0.55)' }}>
      <form role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title" noValidate onSubmit={handleCreate} style={{ ...card, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 650, maxHeight: 'calc(100dvh - 32px)', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: `1px solid ${border}` }}><h2 id="assignment-modal-title" style={{ margin: 0, fontSize: 19 }}>New assignment</h2><button type="button" aria-label="Close" onClick={closeModal} disabled={isSubmitting} style={{ ...secondaryAction, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}><X size={18} /></button></div>
        <div style={{ overflowY: 'auto', minHeight: 0, padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 16 }}>
          <Field label="Bridge"><select required value={form.bridge_id} onChange={(event) => setForm((previous) => ({ ...previous, bridge_id: event.target.value }))} style={input}><option value="">Select bridge</option>{bridges.map((bridge) => <option key={bridge.id} value={bridge.id}>{bridge.name}</option>)}</select></Field>
          <Field label="Assign to"><select required value={form.assigned_to_id} onChange={(event) => setForm((previous) => ({ ...previous, assigned_to_id: event.target.value }))} style={input}><option value="">Select engineer</option>{engineers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.email})</option>)}</select></Field>
          <Field label="Task type"><select required value={form.task_type} onChange={(event) => setForm((previous) => ({ ...previous, task_type: event.target.value }))} style={input}>{Object.entries(taskLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Priority"><select required value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))} style={input}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Due date"><input required type="date" value={form.due_date} onChange={(event) => setForm((previous) => ({ ...previous, due_date: event.target.value }))} style={input} /></Field>
          <Field label="Description"><textarea required value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} style={{ ...input, minHeight: 86 }} /></Field>
        </div>
        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${border}`, background: '#fff' }}>
          {modalError && <p role="alert" style={{ margin: '0 0 10px', color: '#9B4242', fontSize: 13 }}>{modalError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10 }}><button type="button" onClick={closeModal} disabled={isSubmitting} style={secondaryAction}>Cancel</button><button type="submit" disabled={isSubmitting} style={{ ...action, opacity: isSubmitting ? 0.65 : 1 }}>{isSubmitting ? 'Creating…' : 'Create assignment'}</button></div>
        </div>
      </form>
    </div>}
  </main>;
}
