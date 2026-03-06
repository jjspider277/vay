import { useMemo, useCallback } from 'react';
import { Vehicle } from './types';
import { LOW_BATTERY_THRESHOLD, MS_PER_MINUTE } from './constants';

interface ActiveTripsProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onDispatchSupport: (vehicle: Vehicle) => void;
}

const ActiveTrips = ({ vehicles, onSelectVehicle, onDispatchSupport }: ActiveTripsProps) => {
  const activeTrips = useMemo(
    () => vehicles.filter(v => v.activeTrip),
    [vehicles]
  );

  const formatDuration = useCallback((ms: number) => {
    const minutes = Math.floor(ms / MS_PER_MINUTE);
    return `${minutes} min`;
  }, []);

  if (activeTrips.length === 0) {
    return null;
  }

  return (
    <div className="active-trips-panel">
      <h3>Active Trips ({activeTrips.length})</h3>
      <div className="trips-list">
        {activeTrips.map(vehicle => {
          const trip = vehicle.activeTrip!;
          const duration = Date.now() - trip.startTime;
          const progress = Math.min(100, (duration / trip.estimatedDuration) * 100);
          
          return (
            <div 
              key={vehicle.id} 
              className="trip-item"
              onClick={() => onSelectVehicle(vehicle)}
            >
              <div className="trip-header">
                <strong>{vehicle.id}</strong>
                <span className="trip-duration">{formatDuration(duration)}</span>
              </div>
              
              <div className="trip-customer">
                Customer: {trip.customerId}
              </div>

              {vehicle.battery < LOW_BATTERY_THRESHOLD && (
                <div className="trip-low-battery">LOW BATTERY: {Math.round(vehicle.battery)}%</div>
              )}
              
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="trip-actions">
                <button 
                  className="btn-small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectVehicle(vehicle);
                  }}
                >
                  Open Vehicle
                </button>
                <button 
                  className="btn-small btn-warning" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDispatchSupport(vehicle);
                  }}
                >
                  Dispatch Support
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveTrips;
