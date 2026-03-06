import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Vehicle, VehicleStatus } from './types';
import CoverageHeatmap from './CoverageHeatmap';
import { LOW_BATTERY_THRESHOLD } from './constants';
import 'leaflet/dist/leaflet.css';

/**
 * Builds a directional divIcon with status color, low-battery alarm styling,
 * and optional field-agent marker.
 */
const getVehicleIcon = (status: VehicleStatus, heading: number, battery: number, hasAgent: boolean, isSelected: boolean) => {
  const colors = {
    FREE: '#22c55e',
    WITH_CUSTOMER: '#3b82f6',
    EN_ROUTE: '#f97316',
    WAITING_FIELD_AGENT: '#a855f7'
  };
  
  const isLowBattery = battery < LOW_BATTERY_THRESHOLD;
  const color = isLowBattery ? '#dc2626' : colors[status];
  
  return L.divIcon({
    html: `
      <div class="${isLowBattery ? 'vehicle-blink' : ''}" style="position: relative; width: 34px; height: 34px;">
        ${isLowBattery ? '<div class="vehicle-low-battery-ring"></div>' : ''}
        ${isSelected ? '<div style="position:absolute;left:0;top:0;width:34px;height:34px;border-radius:50%;border:3px solid #111827;background:rgba(255,255,255,0.2);"></div>' : ''}
        <div style="
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: ${color};
          border: ${isSelected ? '3px solid #111827' : '2px solid #ffffff'};
          box-shadow: 0 1px 6px rgba(0,0,0,0.45);
          position: absolute;
          left: 4px;
          top: 4px;
        "></div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid #111827;
          position: absolute;
          left: 11px;
          top: -1px;
          transform: rotate(${heading}deg);
          transform-origin: 50% 14px;
          opacity: 0.9;
        "></div>
        ${isLowBattery ? '<div class="vehicle-low-battery-badge">!</div>' : ''}
        ${hasAgent ? '<div style="position:absolute;top:-3px;left:-3px;width:12px;height:12px;background:#f97316;border:1.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.45);"></div>' : ''}
      </div>
    `,
    className: 'vehicle-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

interface FleetMapProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  selectedVehicle: Vehicle | null;
  showCoverage: boolean;
  setShowCoverage: (show: boolean) => void;
  filters: {
    FREE: boolean;
    WITH_CUSTOMER: boolean;
    EN_ROUTE: boolean;
    WAITING_FIELD_AGENT: boolean;
    lowBattery: boolean;
  };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  mapLayer: string;
  setMapLayer: (layer: string) => void;
}

/**
 * Keeps operator context by panning to the selected vehicle without resetting zoom aggressively.
 */
const MapFocus: React.FC<{ selectedVehicle: Vehicle | null }> = ({ selectedVehicle }) => {
  const map = useMap();

  React.useEffect(() => {
    if (!selectedVehicle) {
      return;
    }

    map.flyTo([selectedVehicle.location.lat, selectedVehicle.location.lng], Math.max(map.getZoom(), 13), {
      duration: 0.5,
    });
  }, [selectedVehicle, map]);

  return null;
};

const FleetMap: React.FC<FleetMapProps> = ({ vehicles, onSelectVehicle, selectedVehicle, showCoverage, setShowCoverage, filters, setFilters, mapLayer, setMapLayer }) => {
  const [showFilterMenu, setShowFilterMenu] = React.useState(false);
  const [legendOpen, setLegendOpen] = React.useState(true);
  const selectedRoute = selectedVehicle?.route && selectedVehicle.route.length > 1 ? selectedVehicle.route : null;

  const toggleFilter = (key: 'FREE' | 'WITH_CUSTOMER' | 'EN_ROUTE' | 'WAITING_FIELD_AGENT' | 'lowBattery') => {
    setFilters((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  // Small strategy switch to keep map-layer behavior explicit and easy to extend.
  const getTileLayer = () => {
    switch (mapLayer) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Esri'
        };
      case 'dark':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; OpenStreetMap, &copy; CARTO'
        };
      case 'light':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; OpenStreetMap, &copy; CARTO'
        };
      default: // streets
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap'
        };
    }
  };
  
  const tileLayer = getTileLayer();
  
  return (
    <>
      <div className="map-legend-card">
        <button className="legend-toggle" onClick={() => setLegendOpen(v => !v)}>
          <span>Legend</span>
          <span>{legendOpen ? '▾' : '▸'}</span>
        </button>
        {legendOpen && (
          <div className="legend-body">
            <div className="legend-row"><span className="legend-dot free"></span> Free</div>
            <div className="legend-row"><span className="legend-dot customer"></span> With Customer</div>
            <div className="legend-row"><span className="legend-dot enroute"></span> En Route</div>
            <div className="legend-row"><span className="legend-dot waiting"></span> Waiting Field Agent</div>
            <div className="legend-row"><span className="legend-dot lowbattery legend-blink"></span> Low Battery (&lt;{LOW_BATTERY_THRESHOLD}%)</div>
            <div className="legend-note">Orange badge: field agent assigned</div>
          </div>
        )}
      </div>

      <div className="map-filter-dropdown">
        <button className="map-filter-toggle" onClick={() => setShowFilterMenu(v => !v)}>
          Map Filters
        </button>
        {showFilterMenu && (
          <div className="map-filter-menu">
            <h4>1) Choose Vehicle Status</h4>
            <label className="map-filter-row">
              <input type="checkbox" checked={filters.FREE} onChange={() => toggleFilter('FREE')} />
              <span className="status-dot" style={{ background: '#22c55e' }}></span>
              FREE
            </label>
            <label className="map-filter-row">
              <input type="checkbox" checked={filters.WITH_CUSTOMER} onChange={() => toggleFilter('WITH_CUSTOMER')} />
              <span className="status-dot" style={{ background: '#3b82f6' }}></span>
              WITH CUSTOMER
            </label>
            <label className="map-filter-row">
              <input type="checkbox" checked={filters.EN_ROUTE} onChange={() => toggleFilter('EN_ROUTE')} />
              <span className="status-dot" style={{ background: '#f97316' }}></span>
              EN ROUTE
            </label>
            <label className="map-filter-row">
              <input type="checkbox" checked={filters.WAITING_FIELD_AGENT} onChange={() => toggleFilter('WAITING_FIELD_AGENT')} />
              <span className="status-dot" style={{ background: '#a855f7' }}></span>
              WAITING FIELD AGENT
            </label>

            <h4>2) Focus Battery Risk</h4>
            <label className="map-filter-row">
              <input type="checkbox" checked={filters.lowBattery} onChange={() => toggleFilter('lowBattery')} />
              Low Battery (&lt;{LOW_BATTERY_THRESHOLD}%) Only
            </label>

            <h4>3) Coverage View</h4>
            <label className="map-filter-row">
              <input type="checkbox" checked={showCoverage} onChange={() => setShowCoverage(!showCoverage)} />
              Show Coverage Heatmap (Low = red)
            </label>

            <h4>4) Map Layer</h4>
            <select
              className="map-filter-select"
              value={mapLayer}
              onChange={(e) => setMapLayer(e.target.value)}
            >
              <option value="streets">Streets</option>
              <option value="satellite">Satellite</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        )}
      </div>

      <MapContainer
        center={[36.1699, -115.1398]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url={tileLayer.url}
          attribution={tileLayer.attribution}
        />
        <MapFocus selectedVehicle={selectedVehicle} />
        <CoverageHeatmap show={showCoverage} />
        
        {vehicles.map(vehicle => (
          <React.Fragment key={vehicle.id}>
            <Marker
              position={[vehicle.location.lat, vehicle.location.lng]}
              icon={getVehicleIcon(
                vehicle.status,
                vehicle.heading,
                vehicle.battery,
                !!vehicle.agentDispatched,
                selectedVehicle?.id === vehicle.id
              )}
              eventHandlers={{
                click: () => onSelectVehicle(vehicle)
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                {vehicle.id} · {vehicle.status} · {Math.round(vehicle.battery)}%
                {vehicle.battery < LOW_BATTERY_THRESHOLD ? ' · LOW BATTERY' : ''}
              </Tooltip>
            </Marker>
            
            {vehicle.route && vehicle.route.length > 1 && (
              <>
                <Polyline
                  positions={vehicle.route.map(loc => [loc.lat, loc.lng])}
                  color="#111827"
                  weight={6}
                  opacity={selectedVehicle?.id === vehicle.id ? 0.45 : 0.2}
                />
                <Polyline
                  positions={vehicle.route.map(loc => [loc.lat, loc.lng])}
                  color="#f97316"
                  weight={selectedVehicle?.id === vehicle.id ? 5 : 3}
                  opacity={selectedVehicle?.id === vehicle.id ? 1 : 0.55}
                />
              </>
            )}
          </React.Fragment>
        ))}

        {selectedRoute && (
          <>
            <Polyline
              positions={selectedRoute.map(loc => [loc.lat, loc.lng])}
              color="#2563eb"
              weight={7}
              opacity={0.95}
              dashArray="10 6"
            />
            <CircleMarker
              center={[selectedRoute[0].lat, selectedRoute[0].lng]}
              radius={7}
              pathOptions={{ color: '#ffffff', fillColor: '#16a34a', fillOpacity: 1, weight: 2 }}
            />
            <CircleMarker
              center={[selectedRoute[selectedRoute.length - 1].lat, selectedRoute[selectedRoute.length - 1].lng]}
              radius={7}
              pathOptions={{ color: '#ffffff', fillColor: '#dc2626', fillOpacity: 1, weight: 2 }}
            />
          </>
        )}
      </MapContainer>
    </>
  );
};

export default FleetMap;
