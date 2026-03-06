import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Vehicle, IssueType, VehicleStatus } from './types';
import FleetMap from './FleetMap';
import VehicleDetails from './VehicleDetails';
import DispatchAgent from './DispatchAgent';
import ActiveTrips from './ActiveTrips';
import CustomerChatModal from './CustomerChatModal';
import { API_BASE_URL, LOW_BATTERY_THRESHOLD, STALE_SIGNAL_THRESHOLD_MS } from './constants';
import './App.css';

type FilterState = {
  FREE: boolean;
  WITH_CUSTOMER: boolean;
  EN_ROUTE: boolean;
  WAITING_FIELD_AGENT: boolean;
  lowBattery: boolean;
};

/**
 * Normalizes backend status strings (with/without spaces) into the UI filter keys.
 */
const normalizeStatusKey = (status: string): keyof Omit<FilterState, 'lowBattery'> | null => {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'FREE') return 'FREE';
  if (normalized === 'WITH_CUSTOMER' || normalized === 'WITH CUSTOMER') return 'WITH_CUSTOMER';
  if (normalized === 'EN_ROUTE' || normalized === 'EN ROUTE') return 'EN_ROUTE';
  if (normalized === 'WAITING_FIELD_AGENT' || normalized === 'WAITING FIELD AGENT') return 'WAITING_FIELD_AGENT';
  return null;
};

const App: React.FC = () => {
  const [vehicles, setVehicles] = useState<Map<string, Vehicle>>(new Map());
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showCustomerChat, setShowCustomerChat] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionMessageType, setActionMessageType] = useState<'info' | 'error'>('info');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const [mapLayer, setMapLayer] = useState('streets');
  const [filters, setFilters] = useState<FilterState>({
    FREE: true,
    WITH_CUSTOMER: true,
    EN_ROUTE: true,
    WAITING_FIELD_AGENT: true,
    lowBattery: false
  });

  // Real-time fleet stream: hydrate initial snapshot, then fold incremental updates.
  useEffect(() => {
    const socket: Socket = io(API_BASE_URL);

    socket.on('initial', (initialVehicles: Vehicle[]) => {
      const vehicleMap = new Map<string, Vehicle>();
      initialVehicles.forEach(v => vehicleMap.set(v.id, v));
      setVehicles(vehicleMap);
    });

    socket.on('vehicle-update', (vehicle: Vehicle) => {
      setVehicles(prev => {
        const updated = new Map(prev);
        updated.set(vehicle.id, vehicle);
        return updated;
      });

      setSelectedVehicle(prev => (prev && prev.id === vehicle.id ? vehicle : prev));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const showToast = (message: string, type: 'info' | 'error' = 'info') => {
    setToast({ message, type });
  };

  const handleDispatchAgent = async (issueType: IssueType, notes: string) => {
    if (!selectedVehicle) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles/${selectedVehicle.id}/dispatch-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType, notes })
      });
      
      const updatedVehicle = await response.json();
      if (!response.ok) {
        throw new Error(updatedVehicle?.message || 'Failed to dispatch field agent');
      }
      setVehicles(prev => {
        const updated = new Map(prev);
        updated.set(updatedVehicle.id, updatedVehicle);
        return updated;
      });
      setSelectedVehicle(updatedVehicle);
      setActionMessageType('info');
      setActionMessage(`Field agent dispatched for ${selectedVehicle.id}.`);
      showToast(`Field agent dispatched for ${selectedVehicle.id}.`, 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to dispatch agent';
      setActionMessageType('error');
      setActionMessage(message);
      showToast(message, 'error');
    }
  };

  const filteredVehicles = Array.from(vehicles.values()).filter(v => {
    const statusKey = normalizeStatusKey(v.status);
    if (!statusKey || !filters[statusKey]) return false;
    if (filters.lowBattery && v.battery >= LOW_BATTERY_THRESHOLD) return false;
    return true;
  });

  const allVehicles = Array.from(vehicles.values());
  const lowBatteryCount = allVehicles.filter(v => v.battery < LOW_BATTERY_THRESHOLD).length;
  const staleCount = allVehicles.filter(v => Date.now() - v.lastUpdate > STALE_SIGNAL_THRESHOLD_MS).length;
  const enRouteCount = allVehicles.filter(v => v.status === 'EN_ROUTE').length;
  const withCustomerCount = allVehicles.filter(v => v.status === 'WITH_CUSTOMER').length;
  const waitingFieldAgentCount = allVehicles.filter(v => v.status === VehicleStatus.WAITING_FIELD_AGENT).length;

  const focusLowBattery = () => {
    setFilters({
      FREE: true,
      WITH_CUSTOMER: true,
      EN_ROUTE: true,
      WAITING_FIELD_AGENT: true,
      lowBattery: true
    });
  };

  const clearFilters = () => {
    setFilters({
      FREE: true,
      WITH_CUSTOMER: true,
      EN_ROUTE: true,
      WAITING_FIELD_AGENT: true,
      lowBattery: false
    });
  };

  const focusOnlyStatus = (statusKey: keyof Omit<FilterState, 'lowBattery'>) => {
    setFilters({
      FREE: statusKey === 'FREE',
      WITH_CUSTOMER: statusKey === 'WITH_CUSTOMER',
      EN_ROUTE: statusKey === 'EN_ROUTE',
      WAITING_FIELD_AGENT: statusKey === 'WAITING_FIELD_AGENT',
      lowBattery: false,
    });
  };

  const handleSupportDispatch = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDispatchModal(true);
  };

  /**
   * Requests a low-battery customer swap and tries to focus UI on the replacement car.
   */
  const handleReplaceWithClosestCar = async () => {
    if (!selectedVehicle || actionBusy) return;

    setActionBusy(true);
    setActionMessage('');
    setActionMessageType('info');
    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles/${selectedVehicle.id}/replace-with-closest`, {
        method: 'POST'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || 'Unable to replace car');
      }
      setActionMessageType('info');
      setActionMessage(`Replacement ${result.replacementVehicleId} dispatched. ETA ~${result.etaMinutes} min.`);
      showToast(`Replacement ${result.replacementVehicleId} dispatched. ETA ~${result.etaMinutes} min.`, 'info');

      try {
        const vehiclesResponse = await fetch(`${API_BASE_URL}/api/vehicles`);
        if (vehiclesResponse.ok) {
          const allVehicles: Vehicle[] = await vehiclesResponse.json();
          const replacementVehicle = allVehicles.find(v => v.id === result.replacementVehicleId);
          if (replacementVehicle) {
            setSelectedVehicle(replacementVehicle);
          }
        }
      } catch {
        // Keep current selection if refresh fails.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to replace car';
      setActionMessageType('error');
      setActionMessage(message);
      showToast(message, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Operations</h2>
          <p>{filteredVehicles.length} visible / {vehicles.size} total vehicles</p>
          <div className="sidebar-mini-kpis">
            <span>Low Battery: {lowBatteryCount}</span>
            <span>Stale: {staleCount}</span>
            <span>En Route: {enRouteCount}</span>
            <span>Waiting Agent: {waitingFieldAgentCount}</span>
          </div>
          <div className="sidebar-actions">
            <button className="btn-operator primary" onClick={focusLowBattery}>Focus Low Battery</button>
            <button className="btn-operator" onClick={clearFilters}>Reset View</button>
          </div>
          {actionMessage && (
            <div className={`operator-inline-feedback ${actionMessageType}`}>
              {actionMessage}
            </div>
          )}
        </div>
        {selectedVehicle && (
          <VehicleDetails 
            vehicle={selectedVehicle}
            onClose={() => setSelectedVehicle(null)}
            onDispatchAgent={() => setShowDispatchModal(true)}
            onReplaceWithClosestCar={handleReplaceWithClosestCar}
            onOpenCustomerChat={() => setShowCustomerChat(true)}
            actionBusy={actionBusy}
          />
        )}
        <ActiveTrips
          vehicles={filteredVehicles}
          onSelectVehicle={setSelectedVehicle}
          onDispatchSupport={handleSupportDispatch}
        />
      </div>
      <div className="map-container">
        <div className="operator-alert-bar">
          <button className="alert-chip critical" onClick={focusLowBattery}>Low Battery: {lowBatteryCount}</button>
          <button className="alert-chip warning" onClick={clearFilters}>Stale Signals: {staleCount}</button>
          <button className="alert-chip info" onClick={() => focusOnlyStatus('EN_ROUTE')}>En Route: {enRouteCount}</button>
          <button className="alert-chip info" onClick={() => focusOnlyStatus('WITH_CUSTOMER')}>With Customer: {withCustomerCount}</button>
          <button className="alert-chip warning" onClick={() => focusOnlyStatus('WAITING_FIELD_AGENT')}>Waiting Agent: {waitingFieldAgentCount}</button>
        </div>
        <FleetMap 
          vehicles={filteredVehicles}
          onSelectVehicle={setSelectedVehicle}
          selectedVehicle={selectedVehicle}
          showCoverage={showCoverage}
          setShowCoverage={setShowCoverage}
          filters={filters}
          setFilters={setFilters}
          mapLayer={mapLayer}
          setMapLayer={setMapLayer}
        />
      </div>
      {showDispatchModal && selectedVehicle && (
        <DispatchAgent
          vehicleId={selectedVehicle.id}
          onClose={() => setShowDispatchModal(false)}
          onDispatch={handleDispatchAgent}
        />
      )}
      {showCustomerChat && selectedVehicle && selectedVehicle.activeTrip && (
        <CustomerChatModal
          vehicle={selectedVehicle}
          onClose={() => setShowCustomerChat(false)}
        />
      )}
      {toast && (
        <div className="toast-container">
          <div className={`toast-message ${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
};

export default App;
