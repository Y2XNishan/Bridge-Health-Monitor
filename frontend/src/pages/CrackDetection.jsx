import { useState, useRef } from "react";
import { 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Camera, 
  MapPin, 
  Wrench,
  DollarSign
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SEVERITY_CONFIG = {
  hairline: { color: "#0F6E56", bg: "#F0FDF4", border: "#DCFCE7", label: "Hairline", icon: CheckCircle },
  minor: { color: "#0F6E56", bg: "#F0FDF4", border: "#DCFCE7", label: "Minor", icon: CheckCircle },
  moderate: { color: "#D97706", bg: "#FFFBEB", border: "#FEF3C7", label: "Moderate", icon: AlertTriangle },
  severe: { color: "#991B1B", bg: "#FDF2F2", border: "#FECACA", label: "Severe", icon: AlertTriangle },
  critical: { color: "#991B1B", bg: "#FDF2F2", border: "#FECACA", label: "Critical", icon: AlertTriangle },
};

export default function CrackDetection() {
  const { token } = useAuth();
  const authToken = token || localStorage.getItem("bridgeiq_token") || "";
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bridgeId, setBridgeId] = useState(1);
  const [bridgeName, setBridgeName] = useState("Brahmaputra Main Bridge");
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("bridge_id", bridgeId);
      formData.append("bridge_name", bridgeName);
      const res = await fetch(
        `${API_BASE}/api/crack-detection?bridge_id=${bridgeId}&bridge_name=${encodeURIComponent(bridgeName)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData,
        }
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.hairline : null;
  const SeverityIcon = cfg ? cfg.icon : null;

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Camera size={22} color="#1C1F26" />
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: 'var(--text-primary)', margin: 0 }}>
            AI crack detection
          </h1>
          <span style={{ background: "var(--bg-secondary)", color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
            Vision AI
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: "13px", margin: 0 }}>
          Upload a bridge photo — AI analyzes crack severity, estimates width, and recommends repair action per IRC:112-2011
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: "24px" }}>
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ color: 'var(--text-primary)', margin: "0 0 14px 0", fontSize: "13px", fontWeight: "600" }}>
              Bridge information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: "12px", display: "block", marginBottom: "6px" }}>Bridge ID</label>
                <input
                  type="number"
                  value={bridgeId}
                  onChange={(e) => setBridgeId(Number(e.target.value))}
                  style={{ width: "100%", background: 'var(--bg-secondary)', border: "1px solid var(--border-subtle)", borderRadius: "6px", padding: "8px 12px", color: 'var(--text-primary)', fontSize: "13px", boxSizing: "border-box", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: "12px", display: "block", marginBottom: "6px" }}>Bridge name</label>
                <input
                  type="text"
                  value={bridgeName}
                  onChange={(e) => setBridgeName(e.target.value)}
                  style={{ width: "100%", background: 'var(--bg-secondary)', border: "1px solid var(--border-subtle)", borderRadius: "6px", padding: "8px 12px", color: 'var(--text-primary)', fontSize: "13px", boxSizing: "border-box", outline: "none" }}
                />
              </div>
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px dashed ${preview ? "#0F6E56" : "var(--border-subtle)"}`,
              borderRadius: "8px",
              padding: "32px",
              textAlign: "center",
              cursor: "pointer",
              background: preview ? "rgba(15,110,86,0.03)" : "var(--bg-secondary)",
              transition: "border-color 0.2s ease",
              marginBottom: "16px"
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileSelect(e.target.files[0])} />
            {preview ? (
              <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "280px", borderRadius: "6px", objectFit: "contain" }} />
            ) : (
              <>
                <Upload size={32} color="#475569" style={{ margin: "0 auto 10px auto" }} />
                <p style={{ color: 'var(--text-primary)', fontSize: "13px", fontWeight: "500", margin: "0 0 4px 0" }}>
                  Drag and drop bridge photo here
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: "12px", margin: 0 }}>
                  or click to browse • JPG, PNG, WEBP • Max 10MB
                </p>
              </>
            )}
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FDF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", color: "#991B1B", marginBottom: "16px", fontSize: "13px" }}>
              <AlertCircle size={16} color="#991B1B" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || loading}
            style={{
              width: "100%", padding: "11px 16px", borderRadius: "6px", border: "none",
              background: selectedFile && !loading ? "#1C1F26" : "#E2E8F0",
              color: selectedFile && !loading ? "#ffffff" : "#8B94A3",
              fontSize: "13px", fontWeight: "600", cursor: selectedFile && !loading ? "pointer" : "not-allowed",
              transition: "background-color 0.15s ease"
            }}
          >
            {loading ? "Analyzing image..." : "Analyze crack"}
          </button>
        </div>

        {result && cfg && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "8px", padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                {SeverityIcon && <SeverityIcon size={24} color={cfg.color} />}
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: cfg.color }}>{cfg.label} crack</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: "12px" }}>Report ID: {result.report_id}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: "11px" }}>AI confidence</div>
                  <div style={{ color: cfg.color, fontSize: "18px", fontWeight: "700" }}>{result.confidence_percent}%</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                {[
                  { label: "Estimated width", value: `~${result.estimated_width_mm} mm` },
                  { label: "Width range", value: result.width_range },
                  { label: "Crack type", value: result.crack_type },
                  { label: "Length", value: result.length_estimate },
                  { label: "Material", value: result.material },
                  { label: "Cracks found", value: result.crack_count },
                ].map((item) => (
                  <div key={item.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "6px", padding: "10px 12px" }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: "11px", marginBottom: "2px" }}>{item.label}</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: "13px", fontWeight: "600", textTransform: "capitalize" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "6px", padding: "12px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: 'var(--text-secondary)', fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>
                  <MapPin size={13} color="var(--text-secondary)" />
                  <span>Location</span>
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: "13px" }}>{result.location_description}</div>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "6px", padding: "12px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: 'var(--text-secondary)', fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>
                  <Wrench size={13} color="var(--text-secondary)" />
                  <span>Recommended action</span>
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: "13px" }}>{result.recommended_action}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "6px", padding: "10px 12px" }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: "11px", marginBottom: "2px" }}>Estimated repair cost</div>
                  <div style={{ color: "#0F6E56", fontSize: "13px", fontWeight: "600" }}>{result.estimated_repair_cost}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "6px", padding: "10px 12px" }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: "11px", marginBottom: "2px" }}>IRC reference</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: "12px", fontWeight: "500" }}>{result.irc_reference}</div>
                </div>
              </div>
            </div>

            {result.annotated_image_base64 && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: "8px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: 'var(--text-secondary)', fontSize: "12px", fontWeight: "600", marginBottom: "10px" }}>
                  <Camera size={14} color="var(--text-secondary)" />
                  <span>Annotated image</span>
                </div>
                <img
                  src={`data:image/jpeg;base64,${result.annotated_image_base64}`}
                  alt="Annotated crack visual"
                  style={{ width: "100%", borderRadius: "6px", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
