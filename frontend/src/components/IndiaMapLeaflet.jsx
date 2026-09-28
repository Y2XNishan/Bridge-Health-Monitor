import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import indiaGeoJson from '../data/india-soi.json';
import { formatHealthScore } from './StatusBadge';

// Ensure L is attached to window for any plugins
if (typeof window !== 'undefined' && !window.L) {
  window.L = L;
}

function getStatusInfo(healthScore) {
  if (healthScore >= 75) {
    return { label: 'Healthy', color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' };
  }
  if (healthScore >= 50) {
    return { label: 'Monitor', color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' };
  }
  return { label: 'Critical', color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' };
}

export default function IndiaMapLeaflet({
  filteredBridges = [],
  selectedPinBridgeId,
  onSelectBridge,
  onOpenDetails,
  liveBridgeIds = new Set(),
  selectedState = 'All',
  height = '560px',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const markerMapRef = useRef({});

  // ── Initialize Map & Plain Background & Survey of India Boundary ──
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize Leaflet map on plain light background (#F8FAFA), zero external tile requests
    const map = L.map(mapContainerRef.current, {
      center: [22.5, 82.0],
      zoom: 4.8,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Official Survey of India Boundary Overlay on plain #F8FAFA backdrop
    try {
      const boundaryLayer = L.geoJSON(indiaGeoJson, {
        style: {
          color: '#334155', // Slate-700 official border outline
          weight: 1.5,
          opacity: 1.0,
          fillColor: '#FFFFFF', // Crisp white landmass against #F8FAFA canvas
          fillOpacity: 1.0,
        },
        interactive: false,
      }).addTo(map);

      boundaryLayerRef.current = boundaryLayer;

      // Fit map to official Survey of India bounds so all 58 bridges and boundary are visible
      const bounds = boundaryLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 6,
        });
      }
    } catch (e) {
      console.error('[Leaflet SOI GeoJSON error]', e);
    }

    // Add standard Leaflet Zoom Control in topright
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Attribution: Survey of India boundary only
    L.control.attribution({
      position: 'bottomleft',
      prefix: 'Survey of India boundary',
    }).addTo(map);

    // Initialize MarkerClusterGroup
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      disableClusteringAtZoom: 13, // Individual markers automatically visible at zoom 13+
      maxClusterRadius: 36,
      iconCreateFunction: function (cluster) {
        const childMarkers = cluster.getAllChildMarkers();
        const count = childMarkers.length;

        let hasCritical = false;
        let hasMonitor = false;

        childMarkers.forEach((m) => {
          const status = m.options.bridgeStatus;
          if (status === 'Critical') hasCritical = true;
          else if (status === 'Monitor') hasMonitor = true;
        });

        const color = hasCritical ? '#991B1B' : hasMonitor ? '#D97706' : '#0F6E56';
        const bg = hasCritical ? '#FDF2F2' : hasMonitor ? '#FFFBEB' : '#F0FDF4';

        return L.divIcon({
          html: `<div style="
            background-color: ${bg};
            border: 2px solid ${color};
            color: #1C1F26;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 1px 4px rgba(0,0,0,0.15);
            transition: transform 0.15s ease;
          ">${count}</div>`,
          className: 'bridge-cluster-icon',
          iconSize: L.point(30, 30),
          iconAnchor: L.point(15, 15),
        });
      },
    });

    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    // Invalidate size on initial render
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Render / Update Markers for all filtered bridges ──
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    const map = mapInstanceRef.current;
    if (!clusterGroup || !map) return;

    clusterGroup.clearLayers();
    markerMapRef.current = {};

    filteredBridges.forEach((bridge) => {
      if (bridge.lat == null || bridge.lng == null) return;

      const statusInfo = getStatusInfo(bridge.health_score);
      const isSelected = selectedPinBridgeId === bridge.id;
      const isLive = liveBridgeIds.has(bridge.id);

      const size = isSelected ? 22 : 14;
      const borderSize = isSelected ? 3 : 2;
      const ringShadow = isSelected
        ? '0 0 0 5px rgba(15, 110, 86, 0.45), 0 3px 8px rgba(0,0,0,0.35)'
        : '0 1px 3px rgba(0,0,0,0.25)';

      // Flat circular marker with shared status color and thin white outline
      const icon = L.divIcon({
        html: `<div style="
          background-color: ${statusInfo.color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: ${borderSize}px solid #ffffff;
          box-shadow: ${ringShadow};
          cursor: pointer;
          transition: transform 0.15s ease;
          position: relative;
        ">
          ${isLive ? `<span style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #34D399;
            border: 1px solid #ffffff;
          "></span>` : ''}
        </div>`,
        className: 'bridge-pin-icon',
        iconSize: L.point(size, size),
        iconAnchor: L.point(size / 2, size / 2),
      });

      const marker = L.marker([bridge.lat, bridge.lng], {
        icon,
        bridgeStatus: statusInfo.label,
        bridgeId: bridge.id,
        zIndexOffset: isSelected ? 1000 : 0,
      });

      // Hover Tooltip showing bridge name, location, and health score
      const tooltipContent = `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; color: #1C1F26; padding: 2px 4px; min-width: 140px;">
          <div style="font-weight: 700; font-size: 12px; margin-bottom: 2px;">${bridge.name}</div>
          <div style="color: #64748B; font-size: 10px; margin-bottom: 4px;">${bridge.city || 'Bridge'}, ${bridge.state || ''}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #E2E8F0; padding-top: 4px; margin-top: 4px;">
            <span style="display: inline-flex; align-items: center; gap: 4px; background: ${statusInfo.bg}; border: 1px solid ${statusInfo.border}; padding: 1px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600;">
              <span style="width: 5px; height: 5px; border-radius: 50%; background: ${statusInfo.color};"></span>
              ${statusInfo.label}
            </span>
            <span style="font-family: ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 11px; color: #0F172A;">
              ${formatHealthScore(bridge.health_score)}<span style="font-size: 9px; color: #64748B; font-weight: 400;">/100</span>
            </span>
          </div>
          ${isLive ? '<div style="margin-top: 3px; font-size: 9px; color: #0F6E56; font-weight: 600;">● Live telemetry active</div>' : ''}
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: L.point(0, -size / 2),
        opacity: 0.98,
        className: 'leaflet-clean-tooltip',
      });

      // Clicking a marker selects that bridge
      marker.on('click', () => {
        if (onSelectBridge) onSelectBridge(bridge);
        if (onOpenDetails) onOpenDetails(bridge);
      });

      clusterGroup.addLayer(marker);
      markerMapRef.current[bridge.id] = marker;
    });
  }, [filteredBridges, selectedPinBridgeId, liveBridgeIds, onSelectBridge, onOpenDetails]);

  // ── Open tooltip when marker is selected and visible ──
  useEffect(() => {
    if (selectedPinBridgeId == null) return;
    const marker = markerMapRef.current[selectedPinBridgeId];
    const clusterGroup = clusterGroupRef.current;
    if (marker && clusterGroup) {
      if (clusterGroup.getVisibleParent(marker) === marker) {
        marker.openTooltip();
      }
    }
  }, [selectedPinBridgeId]);

  // ── Auto-fit bounds when state filter is selected ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedState && selectedState !== 'All' && filteredBridges.length > 0) {
      const latLngs = filteredBridges
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => [b.lat, b.lng]);
      if (latLngs.length > 0) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 9 });
      }
    } else if (selectedState === 'All' && boundaryLayerRef.current) {
      const bounds = boundaryLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 6 });
      }
    }
  }, [selectedState, filteredBridges]);

  // Quick View Jump controls
  const handleResetIndiaView = () => {
    const map = mapInstanceRef.current;
    const boundary = boundaryLayerRef.current;
    if (map && boundary) {
      map.fitBounds(boundary.getBounds(), { padding: [20, 20], maxZoom: 6 });
    } else if (map) {
      map.setView([22.5, 82.0], 5);
    }
  };

  const handleFocusSouthIndia = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([11.5, 77.5], 7, { duration: 0.8 });
    }
  };

  return (
    <div
      className="w-full relative rounded-2xl overflow-hidden isolate"
      style={{
        height: height || '560px',
        border: '1px solid var(--border-subtle)',
        background: '#F8FAFA',
        overflow: 'hidden',
      }}
    >
      {/* Quick View Navigation Controls (Top-Right alongside zoom) */}
      <div className="absolute top-3.5 right-14 z-[400] flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleFocusSouthIndia}
          title="Zoom to South India Cluster (Kerala, Tamil Nadu, Karnataka)"
          className="h-7 px-2.5 rounded-lg text-[10px] font-semibold tracking-wide bg-white/95 text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-95 transition cursor-pointer"
        >
          South India
        </button>
        <button
          type="button"
          onClick={handleResetIndiaView}
          title="Reset to full India view"
          className="h-7 px-2.5 rounded-lg text-[10px] font-semibold tracking-wide bg-white/95 text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-95 transition cursor-pointer"
        >
          Fit India
        </button>
      </div>

      {/* Leaflet DOM Container - fills 100% width and height, plain #F8FAFA background */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ zIndex: 1, background: '#F8FAFA' }} 
      />

      {/* Integrated Legend Overlay (Bottom-Right) */}
      <div 
        className="absolute bottom-3.5 right-3.5 p-2 rounded-lg flex flex-col gap-1 text-[9px] pointer-events-none select-none z-[400] w-32 bg-white/95 border border-slate-200 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0F6E56', border: '1.5px solid #fff' }} />
          <span className="font-medium text-slate-700">Healthy (≥75)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D97706', border: '1.5px solid #fff' }} />
          <span className="font-medium text-slate-700">Monitor (50-74)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#991B1B', border: '1.5px solid #fff' }} />
          <span className="font-medium text-slate-700">Critical (&lt;50)</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="w-3.5 h-3.5 rounded-full border border-slate-400 bg-slate-100 text-[8px] font-bold flex items-center justify-center text-slate-700">
            5
          </span>
          <span className="font-medium text-slate-500">Cluster</span>
        </div>
      </div>
    </div>
  );
}
