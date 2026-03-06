import { Injectable } from '@nestjs/common';
import { Vehicle, VehicleEvent, VehicleLog, VehicleLogCategory } from './types';
import {
  COVERAGE_GRID_SIZE,
  COVERAGE_LOW_THRESHOLD,
  COVERAGE_MEDIUM_THRESHOLD,
  LOG_ID_RANDOM_SPACE,
  LOW_BATTERY_THRESHOLD,
  MAX_LOGS_PER_VEHICLE,
  TELEMETRY_LOG_INTERVAL_MS,
} from './constants';

@Injectable()
export class VehicleService {
  private vehicles: Map<string, Vehicle> = new Map();
  private vehicleLogs: Map<string, VehicleLog[]> = new Map();
  private lastTelemetryLogAt: Map<string, number> = new Map();
  private readonly maxLogsPerVehicle = MAX_LOGS_PER_VEHICLE;

  /**
   * Event-sourced projector: folds incoming vehicle events into the current read model.
   * Out-of-order events are ignored using event timestamp vs last known update.
   */
  processEvent(event: VehicleEvent): Vehicle | null {
    const existing = this.vehicles.get(event.vehicleId);

    if (!existing) {
      if (!this.isFullVehicle(event.data)) {
        return null;
      }
      this.vehicles.set(event.vehicleId, event.data);
      this.appendLog(event.vehicleId, {
        category: 'SYSTEM',
        message: 'Vehicle registered in fleet projection',
        timestamp: event.timestamp,
        eventType: event.type
      });
      return event.data;
    }

    if (event.timestamp < existing.lastUpdate) {
      return existing;
    }

    const merged: Vehicle = {
      ...existing,
      ...event.data,
      location: event.data.location ?? existing.location,
      route: event.data.route !== undefined ? event.data.route : existing.route,
      activeTrip: event.data.activeTrip !== undefined ? event.data.activeTrip : existing.activeTrip,
      agentDispatched: event.data.agentDispatched !== undefined ? event.data.agentDispatched : existing.agentDispatched,
      lastUpdate: event.data.lastUpdate ?? event.timestamp
    };

    this.vehicles.set(event.vehicleId, merged);
    this.captureVehicleLogs(existing, merged, event);
    return merged;
  }

  /**
   * Derives operator-facing log entries from state transitions and notable telemetry milestones.
   */
  private captureVehicleLogs(previous: Vehicle, next: Vehicle, event: VehicleEvent) {
    if (previous.status !== next.status) {
      this.appendLog(next.id, {
        category: 'STATUS',
        message: `Status changed ${previous.status} -> ${next.status}`,
        timestamp: event.timestamp,
        eventType: event.type
      });
    }

    if (previous.battery >= LOW_BATTERY_THRESHOLD && next.battery < LOW_BATTERY_THRESHOLD) {
      this.appendLog(next.id, {
        category: 'BATTERY',
        message: `Battery dropped below critical threshold (${Math.round(next.battery)}%)`,
        timestamp: event.timestamp,
        eventType: event.type
      });
    }

    if (previous.activeTrip?.tripId !== next.activeTrip?.tripId) {
      if (next.activeTrip) {
        this.appendLog(next.id, {
          category: 'TRIP',
          message: `Trip assigned ${next.activeTrip.tripId}- ${next.activeTrip.pickupAddress} -> ${next.activeTrip.dropoffAddress}`,
          timestamp: event.timestamp,
          eventType: event.type
        });
      } else if (previous.activeTrip) {
        this.appendLog(next.id, {
          category: 'TRIP',
          message: `Trip completed or cleared ${previous.activeTrip.tripId}`,
          timestamp: event.timestamp,
          eventType: event.type
        });
      }
    }

    if (!previous.agentDispatched && next.agentDispatched) {
      this.appendLog(next.id, {
        category: 'DISPATCH',
        message: `Field support dispatched (${next.agentDispatched.issueType})`,
        timestamp: event.timestamp,
        eventType: event.type
      });
    }

    if (event.type === 'telemetry') {
      const lastLoggedAt = this.lastTelemetryLogAt.get(next.id) ?? 0;
      if (event.timestamp - lastLoggedAt >= TELEMETRY_LOG_INTERVAL_MS) {
        this.appendLog(next.id, {
          category: 'TELEMETRY',
          message: `Telemetry: ${next.location.lat.toFixed(4)}, ${next.location.lng.toFixed(4)} | Battery ${Math.round(next.battery)}%`,
          timestamp: event.timestamp,
          eventType: event.type
        });
        this.lastTelemetryLogAt.set(next.id, event.timestamp);
      }
    } else if (event.type === 'trip_assignment') {
      this.appendLog(next.id, {
        category: 'TRIP',
        message: 'Trip assignment event applied',
        timestamp: event.timestamp,
        eventType: event.type
      });
    } else if (event.type === 'dispatch') {
      this.appendLog(next.id, {
        category: 'DISPATCH',
        message: `Dispatch event applied - ${next.agentDispatched ? next.agentDispatched.issueType : 'no dispatch info'}`,
        timestamp: event.timestamp,
        eventType: event.type
      });
    } else if (event.type === 'route') {
      this.appendLog(next.id, {
        category: 'TRIP',
        message: 'Route updated',
        timestamp: event.timestamp,
        eventType: event.type
      });
    }
  }

  private appendLog(vehicleId: string, entry: Omit<VehicleLog, 'id' | 'vehicleId'>) {
    const current = this.vehicleLogs.get(vehicleId) ?? [];
    const nextEntry: VehicleLog = {
      id: `${vehicleId}-${entry.timestamp}-${Math.floor(Math.random() * LOG_ID_RANDOM_SPACE)}`,
      vehicleId,
      ...entry
    };

    const updated = [nextEntry, ...current].slice(0, this.maxLogsPerVehicle);
    this.vehicleLogs.set(vehicleId, updated);
  }

  private isFullVehicle(data: Partial<Vehicle>): data is Vehicle {
    return (
      typeof data.id === 'string' &&
      !!data.location &&
      typeof data.location.lat === 'number' &&
      typeof data.location.lng === 'number' &&
      typeof data.heading === 'number' &&
      typeof data.battery === 'number' &&
      typeof data.status === 'string' &&
      typeof data.lastUpdate === 'number'
    );
  }

  getAllVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.get(id);
  }

  getVehicleLogs(id: string, category?: VehicleLogCategory): VehicleLog[] {
    const logs = this.vehicleLogs.get(id) ?? [];
    if (!category) {
      return logs;
    }
    return logs.filter(log => log.category === category);
  }

  /**
   * Buckets vehicles into a coarse grid for quick low/medium/high coverage visualization.
   * This favors speed and readability over geospatial precision.
   */
  getCoverageAnalysis() {
    const vehicles = Array.from(this.vehicles.values());
    const gridSize = COVERAGE_GRID_SIZE;
    const grid: Map<string, number> = new Map();

    vehicles.forEach(v => {
      const gridX = Math.floor(v.location.lat / gridSize);
      const gridY = Math.floor(v.location.lng / gridSize);
      const key = `${gridX},${gridY}`;
      grid.set(key, (grid.get(key) || 0) + 1);
    });

    return Array.from(grid.entries()).map(([key, count]) => {
      const [x, y] = key.split(',').map(Number);
      return {
        lat: x * gridSize + gridSize / 2,
        lng: y * gridSize + gridSize / 2,
        count,
        coverage: count < COVERAGE_LOW_THRESHOLD ? 'low' : count < COVERAGE_MEDIUM_THRESHOLD ? 'medium' : 'high'
      };
    });
  }

  /**
   * Returns currently active trips with a naive time-based progress estimate.
   */
  getActiveTrips() {
    return Array.from(this.vehicles.values())
      .filter(v => v.activeTrip)
      .map(v => ({
        vehicle: v,
        trip: v.activeTrip,
        duration: Date.now() - v.activeTrip!.startTime,
        progress: Math.min(100, ((Date.now() - v.activeTrip!.startTime) / v.activeTrip!.estimatedDuration) * 100)
      }));
  }
}
