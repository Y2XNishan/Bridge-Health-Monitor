import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Truck, AlertTriangle, Activity, BarChart2, PieChart, History } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TrafficPanel({ bridgeId = 1 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const prevCrossingTimestampRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function fetchTraffic() {
      try {
        const res = await fetch(`${API_BASE}/api/traffic?bridge_id=${bridgeId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch traffic data: ${res.statusText}`);
        }
        const trafficData = await res.json();
        
        if (!active) return;
        
        setData(trafficData);
        setError("");
        setLoading(false);

        const crossings = trafficData.recent_crossings || [];
        if (crossings.length > 0) {
          const currentTimestamp = crossings[0].timestamp;
          prevCrossingTimestampRef.current = currentTimestamp;
        }
      } catch (err) {
        if (!active) return;
        console.error("[Traffic API Error]", err);
        setError("Telemetry connection offline");
        setLoading(false);
      }
    }

    fetchTraffic();
    const interval = setInterval(fetchTraffic, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [bridgeId]);

  if (loading && !data) {
    return (
      <div
        className="p-8 text-center bg-white border border-slate-200 rounded-[8px]"
        style={{ boxShadow: "none" }}
      >
        <p className="text-xs text-slate-400 font-medium m-0">Loading vehicle telemetry...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        className="p-8 text-center bg-white border border-slate-200 rounded-[8px]"
        style={{ boxShadow: "none" }}
      >
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
          <AlertTriangle size={15} color="#991B1B" />
          {error}
        </div>
      </div>
    );
  }

  const today = data?.today || {
    total_vehicles: 0,
    total_tonnage_estimate: 0,
    overload_events: 0,
    peak_hour: "00:00-00:00",
    fatigue_score: 0.0,
    fatigue_status: "LOW",
    vehicle_breakdown: {},
  };

  const recentCrossings = data?.recent_crossings || [];
  const latestCrossing = recentCrossings[0] || null;

  // Fatigue status badge mapping
  const fatigueStatus = (today.fatigue_status || "LOW").toUpperCase();
  const isFatigueHigh = fatigueStatus === "HIGH" || fatigueStatus === "CRITICAL";
  const isFatigueMod = fatigueStatus === "MODERATE";
  const fatigueColor = isFatigueHigh ? "#991B1B" : isFatigueMod ? "#D97706" : "#0F6E56";
  const fatigueBg = isFatigueHigh ? "#FDF2F2" : isFatigueMod ? "#FFFBEB" : "#F0FDF4";
  const fatigueBorder = isFatigueHigh ? "#FECACA" : isFatigueMod ? "#FEF3C7" : "#DCFCE7";

  // Recharts Hour bars data
  const currentHour = new Date().getHours();
  const chartData = (data?.hourly_counts || Array(24).fill(0)).map((count, index) => {
    const formattedHour = index < 10 ? `0${index}` : `${index}`;
    return {
      hour: formattedHour,
      count: count,
      fill: index === currentHour ? "#0F6E56" : "#E2E8F0",
    };
  });

  const breakdown = today.vehicle_breakdown || {};
  const breakdownData = [
    { name: "Motorcycle", count: breakdown["Motorcycle"] || 0, color: "#8B94A3" },
    { name: "Passenger car", count: breakdown["Passenger Car"] || 0, color: "#475569" },
    { name: "City bus", count: breakdown["City Bus"] || 0, color: "#0F6E56" },
    { name: "Light commercial", count: breakdown["Light Commercial"] || 0, color: "#0F6E56" },
    { name: "Multi-axle truck", count: breakdown["Multi-Axle Truck"] || 0, color: "#D97706" },
    { name: "Overloaded truck", count: breakdown["Overloaded Truck"] || 0, color: "#991B1B" },
  ];
  const totalVehiclesCount = breakdownData.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const breakdownWithPct = breakdownData.map(item => ({
    ...item,
    percentage: (item.count / totalVehiclesCount) * 100
  }));

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "8px",
        padding: "20px",
        boxShadow: "none",
        color: "#1C1F26",
      }}
      id="vehicle-load-monitor"
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #F1F5F9",
          paddingBottom: "14px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Truck size={17} color="#1C1F26" />
          <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#1C1F26", margin: 0 }}>
            Vehicle load monitor
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0F6E56" }} />
          <span style={{ color: "#0F6E56", fontSize: "11px", fontWeight: "500" }}>Live sensor feed active</span>
        </div>
      </div>

      {/* Section 1 — 4 stat cards in a row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {/* Stat 1: Total Vehicles */}
        <div
          style={{
            background: "#F8FAFA",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "500", color: "#8B94A3" }}>Total vehicles</span>
          <span style={{ fontSize: "20px", fontWeight: "700", color: "#1C1F26" }}>
            {today.total_vehicles}
          </span>
        </div>

        {/* Stat 2: Total Tonnage */}
        <div
          style={{
            background: "#F8FAFA",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "500", color: "#8B94A3" }}>Estimated tonnage (t)</span>
          <span style={{ fontSize: "20px", fontWeight: "700", color: "#1C1F26" }}>
            {today.total_tonnage_estimate ? today.total_tonnage_estimate.toFixed(1) : today.total_tonnage ? today.total_tonnage.toFixed(1) : "0.0"}
          </span>
        </div>

        {/* Stat 3: Overload Events */}
        <div
          style={{
            background: today.overload_events > 0 ? "#FDF2F2" : "#F8FAFA",
            border: today.overload_events > 0 ? "1px solid #FECACA" : "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "500", color: today.overload_events > 0 ? "#991B1B" : "#8B94A3" }}>Overload events</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px", fontWeight: "700", color: today.overload_events > 0 ? "#991B1B" : "#1C1F26" }}>
              {today.overload_events}
            </span>
            {today.overload_events > 0 && (
              <span style={{ fontSize: "10px", color: "#991B1B", fontWeight: "600" }}>Limit exceeded</span>
            )}
          </div>
        </div>

        {/* Stat 4: Fatigue Score */}
        <div
          style={{
            background: "#F8FAFA",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "500", color: "#8B94A3" }}>Cyclic fatigue index</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px", fontWeight: "700", color: "#1C1F26" }}>
              {today.fatigue_score ? today.fatigue_score.toFixed(2) : "0.00"}
            </span>
            <span 
              style={{
                fontSize: "10px",
                fontWeight: "600",
                background: fatigueBg,
                color: fatigueColor,
                border: `1px solid ${fatigueBorder}`,
                padding: "2px 6px",
                borderRadius: "4px"
              }}
            >
              {fatigueStatus.toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Section 2 — Live Crossing Event Ticker */}
      <div
        style={{
          background: "#F8FAFA",
          border: "1px solid #E2E8F0",
          borderRadius: "6px",
          padding: "14px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Activity size={13} color="#1C1F26" />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#1C1F26" }}>Real-time crossing event ticker</span>
          </div>
          {latestCrossing && (
            <span style={{ fontSize: "10px", color: "#8B94A3", fontFamily: "monospace" }}>
              Timestamp: {latestCrossing.timestamp}
            </span>
          )}
        </div>

        {latestCrossing ? (
          <div>
            {latestCrossing.is_overloaded && (
              <div
                style={{
                  background: "#FDF2F2",
                  border: "1px solid #FECACA",
                  color: "#991B1B",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "600",
                  textAlign: "center",
                  marginBottom: "10px",
                }}
              >
                Structural overload detected: load exceeds bridge design axle capacity
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontSize: "10px", color: "#8B94A3", display: "block" }}>Vehicle class</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1F26" }}>
                  {latestCrossing.vehicle_type}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "10px", color: "#8B94A3", display: "block" }}>Estimated load</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: latestCrossing.is_overloaded ? "#991B1B" : "#1C1F26" }}>
                  {latestCrossing.weight_estimate_tonnes ? latestCrossing.weight_estimate_tonnes.toFixed(1) : latestCrossing.load_estimate_tonnes ? latestCrossing.load_estimate_tonnes.toFixed(1) : "0.0"} t
                </span>
              </div>

              <div>
                <span style={{ fontSize: "10px", color: "#8B94A3", display: "block" }}>Peak vibration</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1F26" }}>
                  {latestCrossing.peak_vibration ? latestCrossing.peak_vibration.toFixed(2) : "0.00"} g
                </span>
              </div>

              <div>
                <span style={{ fontSize: "10px", color: "#8B94A3", display: "block" }}>Crossing duration</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1F26" }}>
                  {latestCrossing.duration_sec ? latestCrossing.duration_sec.toFixed(1) : "0.0"} s
                </span>
              </div>

              <div>
                <span style={{ fontSize: "10px", color: "#8B94A3", display: "block" }}>Strain delta</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1F26" }}>
                  {latestCrossing.strain_delta ? latestCrossing.strain_delta.toFixed(1) : "0.0"} MPa
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "11px", color: "#8B94A3", textAlign: "center", margin: "8px 0" }}>
            Waiting for first vehicle crossing telemetry...
          </p>
        )}
      </div>

      {/* Sections 3 and 4 side by side in a 2-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Section 3 — Hourly Bar Chart */}
        <div
          style={{
            background: "#F8FAFA",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <BarChart2 size={13} color="#1C1F26" />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#1C1F26" }}>
              Crossing volume (24-hour distribution)
            </span>
          </div>
          <div style={{ width: "100%", height: "180px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis
                  dataKey="hour"
                  stroke="#8B94A3"
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  style={{ fontSize: "9px" }}
                />
                <YAxis
                  stroke="#8B94A3"
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  style={{ fontSize: "9px" }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: "6px",
                    color: '#1C1F26',
                    fontSize: "11px",
                    boxShadow: "none"
                  }}
                  itemStyle={{ color: '#1C1F26' }}
                  labelStyle={{ color: '#8B94A3' }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", background: "#E2E8F0", borderRadius: "1px" }} />
              <span style={{ color: "#8B94A3" }}>Standard hour</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", background: "#0F6E56", borderRadius: "1px" }} />
              <span style={{ color: "#0F6E56", fontWeight: "600" }}>Current hour</span>
            </div>
            <span style={{ color: "#8B94A3" }}>Peak: <span style={{ color: "#1C1F26", fontWeight: "600" }}>{today.peak_hour}</span></span>
          </div>
        </div>

        {/* Section 4 — Vehicle Type Breakdown */}
        <div
          style={{
            background: "#F8FAFA",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <PieChart size={13} color="#1C1F26" />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#1C1F26" }}>
              Classification breakdown & share
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "space-between", height: "100%" }}>
            {breakdownWithPct.map((item) => (
              <div key={item.name} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                  <span style={{ fontWeight: "600", color: "#1C1F26" }}>
                    {item.name}
                  </span>
                  <span style={{ color: "#8B94A3" }}>
                    {item.count} · {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    background: "#E2E8F0",
                    borderRadius: "3px",
                    overflow: "hidden",
                    marginTop: "4px",
                  }}
                >
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: "100%",
                      background: item.color,
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 5 — Recent Crossings Table */}
      <div
        style={{
          background: "#F8FAFA",
          border: "1px solid #E2E8F0",
          borderRadius: "6px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <History size={13} color="#1C1F26" />
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#1C1F26" }}>
            Historical crossing records
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: "8px", fontSize: "11px", fontWeight: "600", color: "#8B94A3" }}>Timestamp</th>
                <th style={{ padding: "8px", fontSize: "11px", fontWeight: "600", color: "#8B94A3" }}>Classification</th>
                <th style={{ padding: "8px", fontSize: "11px", fontWeight: "600", color: "#8B94A3" }}>Weight (t)</th>
                <th style={{ padding: "8px", fontSize: "11px", fontWeight: "600", color: "#8B94A3" }}>Peak vibration</th>
                <th style={{ padding: "8px", fontSize: "11px", fontWeight: "600", color: "#8B94A3" }}>Duration</th>
                <th style={{ padding: "8px", fontSize: "11px", fontWeight: "600", color: "#8B94A3", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCrossings.slice(0, 10).map((row, idx) => {
                const isOverloaded = row.is_overloaded || row.overloaded;
                const weight = row.weight_estimate_tonnes || row.load_estimate_tonnes || 0;
                const peakVib = row.peak_vibration || 0;
                const duration = row.duration_sec || 0;
                const alertLevel = (row.alert_level || (isOverloaded ? "CRITICAL" : "NORMAL")).toUpperCase();

                const isCrit = alertLevel === "CRITICAL";
                const isWarn = alertLevel === "WARNING" || alertLevel === "MONITOR";
                const badgeBg = isCrit ? "#FDF2F2" : isWarn ? "#FFFBEB" : "#F0FDF4";
                const badgeBorder = isCrit ? "#FECACA" : isWarn ? "#FEF3C7" : "#DCFCE7";
                const badgeDot = isCrit ? "#991B1B" : isWarn ? "#D97706" : "#0F6E56";
                const badgeText = isCrit ? "Critical" : isWarn ? "Monitor" : "Healthy";

                return (
                  <tr
                    key={`${row.timestamp}-${idx}`}
                    style={{
                      borderBottom: "1px solid #F1F5F9",
                      background: isOverloaded ? "#FDF2F2" : "transparent",
                    }}
                  >
                    <td style={{ padding: "8px", fontSize: "11px", color: "#8B94A3", fontFamily: "monospace" }}>
                      {row.timestamp ? row.timestamp.split(" ")[1] || row.timestamp : "00:00:00"}
                    </td>

                    <td style={{ padding: "8px", fontSize: "11px", color: "#1C1F26", fontWeight: "600" }}>
                      {row.vehicle_type}
                    </td>

                    <td style={{ padding: "8px", fontSize: "11px", color: isOverloaded ? "#991B1B" : "#1C1F26", fontWeight: isOverloaded ? "600" : "normal" }}>
                      {weight.toFixed(1)} t
                    </td>

                    <td style={{ padding: "8px", fontSize: "11px", color: "#475569" }}>
                      {peakVib.toFixed(2)} g
                    </td>

                    <td style={{ padding: "8px", fontSize: "11px", color: "#475569" }}>
                      {duration.toFixed(1)} s
                    </td>

                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <span
                        style={{
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          color: "#1C1F26",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "10px",
                          fontWeight: "500",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: badgeDot }} />
                        {badgeText}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {recentCrossings.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "16px 8px", fontSize: "11px", color: "#8B94A3", textAlign: "center" }}>
                    No vehicle crossing history recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
