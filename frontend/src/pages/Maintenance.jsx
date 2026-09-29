import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createMaintenanceAssignment,
  deleteMaintenanceAssignment,
  fetchBridges,
  fetchMaintenanceAssignments,
  fetchMaintenanceEngineers,
  updateMaintenanceAssignment,
} from '../api';

const TASK_TYPES = [
  'ROUTINE_INSPECTION',
  'CRACK_REPAIR',
  'SENSOR_REPLACEMENT',
  'STRUCTURAL_REPAIR',
  'EMERGENCY_RESPONSE',
  'LOAD_TESTING',
];

const PRIORITY_STYLES = {
  CRITICAL: { background: '#FDF2F2', color: '#991B1B', border: '1px solid #FECACA' },
  HIGH: { background: '#FFFBEB', color: '#D97706', border: '1px solid #FEF3C7' },
  MEDIUM: { background: '#FFFBEB', color: '#D97706', border: '1px solid #FEF3C7' },
  LOW: { background: '#F0FDF4', color: '#0F6E56', border: '1px solid #DCFCE7' },
};

const STATUS_STYLES = {
  PENDING: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' },
  IN_PROGRESS: { background: '#F8FAFA', color: '#1C1F26', border: '1px solid var(--border-subtle)' },
  COMPLETED: { background: '#F0FDF4', color: '#0F6E56', border: '1px solid #DCFCE7' },
  CANCELLED: { background: '#FDF2F2', color: '#991B1B', border: '1px solid #FECACA' },
};

const EMPTY_FORM = {
  bridge_id: 1,
  bridge_name: 'Bridge 1',
  assigned_to_email: '',
  assigned_to_name: '',
  priority: 'MEDIUM',
  task_type: 'ROUTINE_INSPECTION',
  description: '',
  due_date: '',
};

function Badge({ value, styles }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={styles[value] || styles.PENDING || styles.LOW}>
      {value.replace('_', ' ')}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

export default function Maintenance() {
  const { user, isAdmin } = useAuth();
  const admin = isAdmin && isAdmin();
  const location = useLocation();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notesById, setNotesById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const bridgeOptions = useMemo(() => {
    const fetched = new Map((bridges || []).map((bridge) => [Number(bridge.id), bridge.name]));
    return Array.from({ length: 58 }, (_, index) => {
      const id = index + 1;
      return { id, name: fetched.get(id) || `Bridge ${id}` };
    });
  }, [bridges]);

  const stats = useMemo(() => ({
    PENDING: assignments.filter((a) => a.status === 'PENDING').length,
    IN_PROGRESS: assignments.filter((a) => a.status === 'IN_PROGRESS').length,
    COMPLETED: assignments.filter((a) => a.status === 'COMPLETED').length,
    TOTAL: assignments.length,
  }), [assignments]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [assignmentData, bridgeData] = await Promise.all([
        fetchMaintenanceAssignments(),
        fetchBridges(),
      ]);
      setAssignments(assignmentData);
      setBridges(bridgeData);
      if (admin) {
        const engineerData = await fetchMaintenanceEngineers();
        setEngineers(engineerData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (location.state?.preselectedBridge) {
      const bridge = location.state.preselectedBridge;
      setForm((prev) => ({
        ...prev,
        bridge_id: Number(bridge.id),
        bridge_name: bridge.name,
      }));
      if (admin) {
        setIsModalOpen(true);
      }
    }
  }, [location.state, admin]);

  useEffect(() => {
    const selectedBridge = bridgeOptions.find((bridge) => bridge.id === form.bridge_id);
    if (selectedBridge && form.bridge_name !== selectedBridge.name) {
      setForm((prev) => ({ ...prev, bridge_name: selectedBridge.name }));
    }
  }, [bridgeOptions, form.bridge_id, form.bridge_name]);

  function updateForm(field, value) {
    if (field === 'bridge_id') {
      const bridge = bridgeOptions.find((b) => b.id === Number(value));
      setForm((prev) => ({ ...prev, bridge_id: Number(value), bridge_name: bridge?.name || `Bridge ${value}` }));
      return;
    }
    if (field === 'assigned_to_email') {
      const engineer = engineers.find((eng) => eng.email === value);
      setForm((prev) => ({ ...prev, assigned_to_email: value, assigned_to_name: engineer?.name || '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    await createMaintenanceAssignment(form);
    setForm(EMPTY_FORM);
    setIsModalOpen(false);
    loadData();
  }

  async function handleStatusChange(assignmentId, status, notes) {
    await updateMaintenanceAssignment(assignmentId, notes ? { status, notes } : { status });
    setNotesById((prev) => ({ ...prev, [assignmentId]: '' }));
    loadData();
  }

  async function handleDelete(assignmentId) {
    await deleteMaintenanceAssignment(assignmentId);
    loadData();
  }

  function inputClass() {
    return 'w-full rounded-xl border bg-[var(--bg-card)] px-4 py-3 text-sm outline-none focus:border-[#58a6ff]';
  }

  if (isLoading) {
    return <div className="p-6 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>Loading maintenance assignments...</div>;
  }

  const showBanner = location.state?.preselectedBridge && !bannerDismissed;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Preselected Bridge Banner */}
      {showBanner && (
        <div 
          className="flex items-center justify-between animate-fade-in-up"
          style={{
            backgroundColor: '#fff7ed',
            border: '0.5px solid #fed7aa',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#c2410c',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          <span>
            Redirected from predictive maintenance — {location.state.preselectedBridge.name} requires urgent crew assignment
          </span>
          <button 
            type="button" 
            onClick={() => setBannerDismissed(true)}
            className="text-[#c2410c] hover:opacity-80 font-bold ml-4 cursor-pointer text-sm font-sans"
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-title">Maintenance Crew Assignment</p>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {admin ? 'Crew Dispatch Console' : 'My Assigned Maintenance Tasks'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Logged in as {user?.name} ({user?.role})
          </p>
        </div>
        {admin && (
          <button
            className="rounded-xl px-5 py-3 text-xs font-black tracking-widest text-white transition hover:opacity-90"
            style={{ background: 'var(--accent-blue-light)', border: '1px solid #58a6ff' }}
            onClick={() => setIsModalOpen(true)}
          >
            New assignment
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: '#160000', borderColor: '#ff7b72', color: '#ff7b72' }}>
          {error}
        </div>
      )}

      {admin ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              ['Pending', stats.PENDING],
              ['In progress', stats.IN_PROGRESS],
              ['Completed', stats.COMPLETED],
              ['Total assignments', stats.TOTAL],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                <p className="text-[10px] font-black tracking-widest" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="mt-3 text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <tr>
                    {['Bridge', 'Assigned To', 'Task Type', 'Priority', 'Status', 'Due Date', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-4 py-4 font-bold" style={{ color: 'var(--text-primary)' }}>{assignment.bridge_name}</td>
                      <td className="px-4 py-4" style={{ color: 'var(--text-secondary)' }}>{assignment.assigned_to_name}</td>
                      <td className="px-4 py-4 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{assignment.task_type}</td>
                      <td className="px-4 py-4"><Badge value={assignment.priority} styles={PRIORITY_STYLES} /></td>
                      <td className="px-4 py-4">
                        <select
                          className="rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-xs font-bold outline-none"
                          style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }}
                          value={assignment.status}
                          onChange={(e) => handleStatusChange(assignment.id, e.target.value)}
                        >
                          {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4" style={{ color: 'var(--text-secondary)' }}>{assignment.due_date || 'No due date'}</td>
                      <td className="px-4 py-4">
                        <button className="rounded-lg border px-3 py-2 text-xs font-black" style={{ borderColor: '#ff7b72', color: '#ff7b72' }} onClick={() => handleDelete(assignment.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-sm" colSpan="7" style={{ color: 'var(--text-secondary)' }}>No assignments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{assignment.bridge_name}</h2>
                  <p className="mt-1 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{assignment.task_type}</p>
                </div>
                <Badge value={assignment.priority} styles={PRIORITY_STYLES} />
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-primary)' }}>{assignment.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Badge value={assignment.status} styles={STATUS_STYLES} />
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Due: {assignment.due_date || 'No due date'}</span>
              </div>
              {assignment.status === 'PENDING' && (
                <button className="mt-5 rounded-xl px-4 py-2 text-xs font-black tracking-widest text-white" style={{ background: 'var(--accent-blue-light)' }} onClick={() => handleStatusChange(assignment.id, 'IN_PROGRESS')}>
                  Start task
                </button>
              )}
              {assignment.status === 'IN_PROGRESS' && (
                <div className="mt-5 space-y-3">
                  <textarea
                    className={`${inputClass()} min-h-24`}
                    style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }}
                    placeholder="Completion notes..."
                    value={notesById[assignment.id] || ''}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [assignment.id]: e.target.value }))}
                  />
                  <button className="rounded-xl px-4 py-2 text-xs font-black tracking-widest text-white" style={{ background: '#3fb950' }} onClick={() => handleStatusChange(assignment.id, 'COMPLETED', notesById[assignment.id] || '')}>
                    Complete
                  </button>
                </div>
              )}
            </div>
          ))}
          {assignments.length === 0 && (
            <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              No assignments are currently assigned to you.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <form className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }} onSubmit={handleCreate}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>New Assignment</h2>
              <button type="button" className="text-2xl" style={{ color: 'var(--text-secondary)' }} onClick={() => setIsModalOpen(false)}>x</button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Bridge">
                <select className={inputClass()} style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }} value={form.bridge_id} onChange={(e) => updateForm('bridge_id', e.target.value)}>
                  {bridgeOptions.map((bridge) => <option key={bridge.id} value={bridge.id}>{bridge.id} - {bridge.name}</option>)}
                </select>
              </Field>
              <Field label="Assign To">
                <select className={inputClass()} style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }} value={form.assigned_to_email} onChange={(e) => updateForm('assigned_to_email', e.target.value)} required>
                  <option value="">Select engineer</option>
                  {engineers.map((engineer) => <option key={`${engineer.id}-${engineer.email}`} value={engineer.email}>{engineer.name} ({engineer.email})</option>)}
                </select>
              </Field>
              <Field label="Task Type">
                <select className={inputClass()} style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }} value={form.task_type} onChange={(e) => updateForm('task_type', e.target.value)}>
                  {TASK_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={inputClass()} style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }} value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                <input className={inputClass()} style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }} type="date" value={form.due_date} onChange={(e) => updateForm('due_date', e.target.value)} />
              </Field>
              <Field label="Description">
                <textarea className={`${inputClass()} min-h-28`} style={{ borderColor: 'var(--border-hover)', color: 'var(--text-primary)' }} value={form.description} onChange={(e) => updateForm('description', e.target.value)} required />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-xl border px-5 py-3 text-xs font-black tracking-widest" style={{ borderColor: 'var(--border-hover)', color: 'var(--text-secondary)' }} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="rounded-xl px-5 py-3 text-xs font-black tracking-widest text-white" style={{ background: 'var(--accent-blue-light)' }}>
                Submit assignment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
