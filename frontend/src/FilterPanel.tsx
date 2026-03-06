import { memo } from 'react';

interface FilterPanelProps {
  vehicleCount: number;
  totalCount: number;
  mapLayer: string;
  setMapLayer: (layer: string) => void;
  lowBatteryCount: number;
  staleCount: number;
  enRouteCount: number;
  withCustomerCount: number;
  onFocusLowBattery: () => void;
  onClearFilters: () => void;
}

const FilterPanel = ({ 
  vehicleCount, 
  totalCount,
  mapLayer,
  setMapLayer,
  lowBatteryCount,
  staleCount,
  enRouteCount,
  withCustomerCount,
  onFocusLowBattery,
  onClearFilters
}: FilterPanelProps) => {
  return (
    <div className="filter-panel">
      <h2>Fleet Radar</h2>
      <div className="vehicle-count">
        Showing {vehicleCount} of {totalCount} vehicles on map
      </div>

      <div className="ops-kpis">
        <div className="kpi-card">
          <div className="kpi-label">Low Battery</div>
          <div className="kpi-value critical">{lowBatteryCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Stale Updates</div>
          <div className="kpi-value warning">{staleCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">En Route</div>
          <div className="kpi-value">{enRouteCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">With Customer</div>
          <div className="kpi-value">{withCustomerCount}</div>
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn-operator primary" onClick={onFocusLowBattery}>
          Focus Low Battery Vehicles
        </button>
        <button className="btn-operator" onClick={onClearFilters}>
          Show Full Fleet
        </button>
      </div>
      
      <div className="filters">
        <h3>Map Filters</h3>
        <p className="filter-hint">
          Use the <strong>Map Filters</strong> dropdown on the map for status, battery, and coverage controls.
        </p>
        
        <h3>4) Map Style</h3>
        <select 
          value={mapLayer} 
          onChange={(e) => setMapLayer(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #dee2e6',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="streets">Streets</option>
          <option value="satellite">Satellite</option>
          <option value="dark">Dark Mode</option>
          <option value="light">Light</option>
        </select>
      </div>
    </div>
  );
};

export default memo(FilterPanel);
