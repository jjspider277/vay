import { Injectable } from '@nestjs/common';
import { Vehicle, VehicleStatus, Location, VehicleEvent, IssueType, Trip } from './types';
import {
  AGENT_ID_POOL_SIZE,
  BULK_BATTERY_MIN,
  BULK_BATTERY_RANGE,
  DEFAULT_FLEET_SIZE,
  DEFAULT_SIMULATION_SPEED_MULTIPLIER,
  DEFAULT_TELEMETRY_TICK_MS,
  DRIFT_STEP_FACTOR,
  HEADING_STEP_FACTOR,
  LOG_ID_RANDOM_SPACE,
  INITIAL_BATTERY_MIN,
  INITIAL_BATTERY_RANGE,
  MOVING_BATTERY_DRAIN,
  RANDOM_LOCATION_JITTER,
  ROUTE_CACHE_COORDINATE_PRECISION,
  ROUTE_STEP_FACTOR,
  STATUS_REEVALUATION_CHANCE,
  SYNTHETIC_ROUTE_CURVE_AMPLITUDE,
  SYNTHETIC_ROUTE_POINT_COUNT,
  TRIP_DURATION_BASE_MS,
  TRIP_DURATION_VARIANCE_MS,
  VEHICLE_ID_PADDING,
  WAITING_BATTERY_DRAIN,
  EN_ROUTE_STATUS_PROBABILITY,
  WITH_CUSTOMER_STATUS_PROBABILITY,
} from './constants';
import { calculateDistanceKm, estimateEtaMinutes } from './utils/geo';

interface TripAssignmentPayload {
  tripId: string;
  customerId: string;
  pickupLocation: Location;
  pickupAddress: string;
  dropoffLocation: Location;
  dropoffAddress: string;
}

type ReplaceVehicleResult =
  | {
    ok: true;
    replacedVehicleEvent: VehicleEvent;
    replacementVehicleEvent: VehicleEvent;
    replacementVehicleId: string;
    etaMinutes: number;
  }
  | {
    ok: false;
    reason: 'SOURCE_VEHICLE_NOT_READY' | 'NO_FREE_VEHICLE';
  };

type GoogleComputeRoutesResponse = {
  routes?: Array<{
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
};

@Injectable()
export class EventGenerator {
  private vehicles: Map<string, Vehicle> = new Map();
  private readonly routeCache: Map<string, Location[]> = new Map();
  private readonly fleetSize = Number(process.env.FLEET_SIZE || DEFAULT_FLEET_SIZE);
  private readonly telemetryTickMs = Number(process.env.TELEMETRY_TICK_MS || DEFAULT_TELEMETRY_TICK_MS);
  private readonly simulationSpeedMultiplier = Number(process.env.SIMULATION_SPEED_MULTIPLIER || DEFAULT_SIMULATION_SPEED_MULTIPLIER);
  private readonly googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  private readonly googleRoutesDebug = process.env.GOOGLE_ROUTES_DEBUG === '1';
  private nextVehicleNumber = 0;

  // Real Las Vegas addresses (landmarks)
  private readonly LAS_VEGAS_LOCATIONS = [
    { name: 'Bellagio', lat: 36.1129, lng: -115.1765 },
    { name: 'MGM Grand', lat: 36.1024, lng: -115.1699 },
    { name: 'Caesars Palace', lat: 36.1162, lng: -115.1745 },
    { name: 'The Venetian', lat: 36.1212, lng: -115.1697 },
    { name: 'Luxor', lat: 36.0955, lng: -115.1761 },
    { name: 'Mandalay Bay', lat: 36.0909, lng: -115.1744 },
    { name: 'Wynn', lat: 36.1271, lng: -115.1656 },
    { name: 'Aria', lat: 36.1067, lng: -115.1765 },
    { name: 'Paris', lat: 36.1125, lng: -115.1708 },
    { name: 'New York New York', lat: 36.1023, lng: -115.1740 },
    { name: 'Excalibur', lat: 36.0985, lng: -115.1758 },
    { name: 'Mirage', lat: 36.1213, lng: -115.1742 },
    { name: 'Treasure Island', lat: 36.1247, lng: -115.1722 },
    { name: 'Circus Circus', lat: 36.1368, lng: -115.1639 },
    { name: 'Stratosphere', lat: 36.1475, lng: -115.1566 },
    { name: 'Downtown Las Vegas', lat: 36.1699, lng: -115.1398 },
    { name: 'Las Vegas Convention Center', lat: 36.1329, lng: -115.1534 },
    { name: 'T-Mobile Arena', lat: 36.1029, lng: -115.1784 },
    { name: 'Allegiant Stadium', lat: 36.0909, lng: -115.1833 },
    { name: 'UNLV', lat: 36.1085, lng: -115.1469 },
  ];

  constructor() {
    //this.initializeVehicles().catch(err => console.error('Failed to initialize vehicles:', err));
  }

  /**
   * Seeds the in-memory fleet projection at startup.
   * This represents the latest committed state snapshot consumed by downstream services.
   */
  private async initializeVehicles() {
    for (let i = 0; i < this.fleetSize; i++) {
      const status = this.randomStatus();
      const vehicle: Vehicle = {
        id: `VEH-${String(i).padStart(VEHICLE_ID_PADDING, '0')}`,
        location: this.randomLocation(),
        heading: Math.random() * 360,
        battery: INITIAL_BATTERY_MIN + Math.random() * INITIAL_BATTERY_RANGE,
        status,
        lastUpdate: Date.now()
      };

      if (vehicle.status === VehicleStatus.EN_ROUTE) {
        vehicle.route = await this.generateRoute(vehicle.location);
      }

      if (vehicle.status === VehicleStatus.WITH_CUSTOMER) {
        vehicle.activeTrip = this.generateTrip(vehicle.location);
      }

      this.vehicles.set(vehicle.id, vehicle);
    }

    this.nextVehicleNumber = this.fleetSize;
  }

  getAllVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }

  getVehicle(vehicleId: string): Vehicle | undefined {
    return this.vehicles.get(vehicleId);
  }

  /**
   * Applies a trip assignment command by building a pickup+dropoff route and emitting
   * a single domain event that can be fanned out to WebSocket clients.
   */
  async assignTripToVehicle(vehicleId: string, trip: TripAssignmentPayload): Promise<VehicleEvent | null> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      return null;
    }

    vehicle.status = VehicleStatus.EN_ROUTE;
    const toPickup = await this.generateRoute(vehicle.location, trip.pickupLocation);
    const toDropoff = await this.generateRoute(trip.pickupLocation, trip.dropoffLocation);
    vehicle.route = [...toPickup, ...toDropoff.slice(1)];
    vehicle.activeTrip = {
      tripId: trip.tripId,
      customerId: trip.customerId,
      pickupLocation: trip.pickupLocation,
      dropoffLocation: trip.dropoffLocation,
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress,
      startTime: Date.now(),
      estimatedDuration: TRIP_DURATION_BASE_MS + Math.random() * TRIP_DURATION_VARIANCE_MS
    };
    vehicle.lastUpdate = Date.now();

    return this.buildEvent(vehicle, 'trip_assignment');
  }

  /**
   * Marks a vehicle as waiting for field support and clears route/trip state.
   */
  dispatchAgentToVehicle(vehicleId: string, issueType: IssueType, notes: string): VehicleEvent | null {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      return null;
    }

    vehicle.agentDispatched = {
      issueType,
      notes,
      timestamp: Date.now(),
      agentId: `AGENT-${Math.floor(Math.random() * AGENT_ID_POOL_SIZE)}`
    };
    vehicle.status = VehicleStatus.WAITING_FIELD_AGENT;
    vehicle.route = undefined;
    vehicle.lastUpdate = Date.now();

    return this.buildEvent(vehicle, 'dispatch');
  }

  /**
   * Transfers an active low-battery trip to the closest FREE vehicle.
   * Returns two events so projections can update both source and replacement cars atomically.
   */
  async replaceVehicleForLowBattery(vehicleId: string): Promise<ReplaceVehicleResult> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || !vehicle.activeTrip) {
      return { ok: false, reason: 'SOURCE_VEHICLE_NOT_READY' };
    }

    const replacement = this.findClosestFreeVehicle(vehicle.location, vehicle.id);
    if (!replacement) {
      return { ok: false, reason: 'NO_FREE_VEHICLE' };
    }

    const currentTrip = vehicle.activeTrip;

    const rendezvousDistanceKm = calculateDistanceKm(replacement.location, vehicle.location);
    const etaMinutes = estimateEtaMinutes(rendezvousDistanceKm);

    replacement.status = VehicleStatus.EN_ROUTE;
    replacement.activeTrip = {
      ...currentTrip,
      startTime: Date.now()
    };
    const toRendezvous = await this.generateRoute(replacement.location, vehicle.location);
    const toDropoff = await this.generateRoute(vehicle.location, currentTrip.dropoffLocation);
    replacement.route = [...toRendezvous, ...toDropoff.slice(1)];
    replacement.lastUpdate = Date.now();

    vehicle.status = VehicleStatus.WAITING_FIELD_AGENT;
    vehicle.route = undefined;
    vehicle.activeTrip = undefined;
    vehicle.agentDispatched = {
      issueType: IssueType.BATTERY_LOW,
      notes: `Vehicle swap initiated. Customer transferred to ${replacement.id}.`,
      timestamp: Date.now(),
      agentId: `AGENT-${Math.floor(Math.random() * AGENT_ID_POOL_SIZE)}`
    };
    vehicle.lastUpdate = Date.now();

    return {
      ok: true,
      replacedVehicleEvent: this.buildEvent(vehicle, 'dispatch'),
      replacementVehicleEvent: this.buildEvent(replacement, 'trip_assignment'),
      replacementVehicleId: replacement.id,
      etaMinutes
    };
  }

  /**
   * Bulk-adds random vehicles for load/testing scenarios and returns registration events.
   */
  addRandomVehicles(count: number): VehicleEvent[] {
    const addedEvents: VehicleEvent[] = [];
    const safeCount = Math.max(0, Math.floor(count));

    for (let i = 0; i < safeCount; i++) {
      const id = this.generateUniqueVehicleId();
      const vehicle: Vehicle = {
        id,
        location: this.randomLocation(),
        heading: Math.random() * 360,
        battery: BULK_BATTERY_MIN + Math.random() * BULK_BATTERY_RANGE,
        status: VehicleStatus.FREE,
        lastUpdate: Date.now()
      };

      this.vehicles.set(vehicle.id, vehicle);
      addedEvents.push(this.buildEvent(vehicle, 'telemetry'));
    }

    return addedEvents;
  }

  generateEvents(callback: (event: VehicleEvent) => void) {
    setInterval(() => {
      const vehicles = Array.from(this.vehicles.values());

      for (const vehicle of vehicles) {
        if (!vehicle) {
          continue;
        }

        this.moveVehicle(vehicle, this.simulationSpeedMultiplier);
        callback(this.buildEvent(vehicle, 'telemetry'));
      }
    }, this.telemetryTickMs);
  }

  private buildEvent(vehicle: Vehicle, type: VehicleEvent['type']): VehicleEvent {
    return {
      type,
      vehicleId: vehicle.id,
      data: { ...vehicle },
      timestamp: Date.now()
    };
  }

  private randomLocation(): Location {
    const landmark = this.LAS_VEGAS_LOCATIONS[Math.floor(Math.random() * this.LAS_VEGAS_LOCATIONS.length)];
    return {
      lat: landmark.lat + (Math.random() - 0.5) * RANDOM_LOCATION_JITTER,
      lng: landmark.lng + (Math.random() - 0.5) * RANDOM_LOCATION_JITTER
    };
  }

  private randomStatus(): VehicleStatus {
    const rand = Math.random();
    if (rand < EN_ROUTE_STATUS_PROBABILITY) return VehicleStatus.EN_ROUTE;
    if (rand < WITH_CUSTOMER_STATUS_PROBABILITY) return VehicleStatus.WITH_CUSTOMER;
    return VehicleStatus.FREE;
  }

  private randomDestination(): Location {
    const destination = this.LAS_VEGAS_LOCATIONS[Math.floor(Math.random() * this.LAS_VEGAS_LOCATIONS.length)];
    return { lat: destination.lat, lng: destination.lng };
  }

  private async generateRoute(start: Location, destination?: Location): Promise<Location[]> {
    const target = destination ?? this.randomDestination();
    const cacheKey = `${Math.round(start.lat * ROUTE_CACHE_COORDINATE_PRECISION)},${Math.round(start.lng * ROUTE_CACHE_COORDINATE_PRECISION)}-${Math.round(target.lat * ROUTE_CACHE_COORDINATE_PRECISION)},${Math.round(target.lng * ROUTE_CACHE_COORDINATE_PRECISION)}`;

    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey)!;
    }

    const googleRoute = await this.generateGoogleRoute(start, target);
    if (googleRoute) {
      this.routeCache.set(cacheKey, googleRoute);
      return googleRoute;
    }

    if (this.googleMapsApiKey && this.googleRoutesDebug) {
      console.warn('[routes] Falling back to synthetic route');
    }

    const route = this.generateSyntheticRoute(start, target);
    // If Google key exists, do not cache fallback routes so the next attempt can retry Google.
    if (!this.googleMapsApiKey) {
      this.routeCache.set(cacheKey, route);
    }
    return route;
  }

  private async generateGoogleRoute(start: Location, target: Location): Promise<Location[] | null> {
    if (!this.googleMapsApiKey) {
      return null;
    }

    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.googleMapsApiKey,
          'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration'
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: start.lat,
                longitude: start.lng
              }
            }
          },
          destination: {
            location: {
              latLng: {
                latitude: target.lat,
                longitude: target.lng
              }
            }
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
          polylineEncoding: 'ENCODED_POLYLINE',
          polylineQuality: 'HIGH_QUALITY'
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (this.googleRoutesDebug) {
          console.warn(`[routes] Google computeRoutes failed (${response.status}): ${errorBody.slice(0, 300)}`);
        }
        return null;
      }

      const payload = (await response.json()) as GoogleComputeRoutesResponse;
      const encoded = payload.routes?.[0]?.polyline?.encodedPolyline;
      if (!encoded) {
        if (this.googleRoutesDebug) {
          console.warn('[routes] Google response has no encoded polyline');
        }
        return null;
      }

      const decoded = this.decodePolyline(encoded);
      return decoded.length > 1 ? decoded : null;
    } catch (error) {
      if (this.googleRoutesDebug) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[routes] Google computeRoutes exception: ${message}`);
      }
      return null;
    }
  }

  private decodePolyline(encoded: string): Location[] {
    const points: Location[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }

  private generateSyntheticRoute(start: Location, target: Location): Location[] {
    const route = [start];
    for (let i = 1; i <= SYNTHETIC_ROUTE_POINT_COUNT; i++) {
      const p = i / SYNTHETIC_ROUTE_POINT_COUNT;
      const curve = Math.sin(p * Math.PI) * SYNTHETIC_ROUTE_CURVE_AMPLITUDE;
      route.push({
        lat: start.lat + (target.lat - start.lat) * p + curve,
        lng: start.lng + (target.lng - start.lng) * p + curve * 0.5
      });
    }
    return route;
  }

  private generateTrip(_currentLocation: Location): Trip {
    const pickupLandmark = this.LAS_VEGAS_LOCATIONS[Math.floor(Math.random() * this.LAS_VEGAS_LOCATIONS.length)];
    const dropoffLandmark = this.LAS_VEGAS_LOCATIONS[Math.floor(Math.random() * this.LAS_VEGAS_LOCATIONS.length)];

    return {
      tripId: `TRIP-${Date.now()}-${Math.floor(Math.random() * LOG_ID_RANDOM_SPACE)}`,
      customerId: `CUST-${Math.floor(Math.random() * LOG_ID_RANDOM_SPACE * 10)}`,
      pickupLocation: {
        lat: pickupLandmark.lat,
        lng: pickupLandmark.lng
      },
      dropoffLocation: {
        lat: dropoffLandmark.lat,
        lng: dropoffLandmark.lng
      },
      pickupAddress: pickupLandmark.name,
      dropoffAddress: dropoffLandmark.name,
      startTime: Date.now() - Math.random() * 1800000,
      estimatedDuration: TRIP_DURATION_BASE_MS + Math.random() * TRIP_DURATION_VARIANCE_MS
    };
  }

  private normalizeHeading(degrees: number): number {
    return ((degrees % 360) + 360) % 360;
  }

  private findClosestFreeVehicle(target: Location, excludeVehicleId?: string): Vehicle | null {
    const freeVehicles = Array.from(this.vehicles.values()).filter(
      candidate => candidate.status === VehicleStatus.FREE && candidate.id !== excludeVehicleId
    );

    if (freeVehicles.length === 0) {
      return null;
    }

    let closest = freeVehicles[0];
    let minDistance = calculateDistanceKm(closest.location, target);

    for (let i = 1; i < freeVehicles.length; i++) {
      const candidate = freeVehicles[i];
      const distance = calculateDistanceKm(candidate.location, target);
      if (distance < minDistance) {
        minDistance = distance;
        closest = candidate;
      }
    }

    return closest;
  }

  private generateUniqueVehicleId(): string {
    let candidate = '';
    do {
      candidate = `VEH-${String(this.nextVehicleNumber).padStart(VEHICLE_ID_PADDING, '0')}`;
      this.nextVehicleNumber += 1;
    } while (this.vehicles.has(candidate));
    return candidate;
  }

  private moveVehicle(vehicle: Vehicle, speedMultiplier: number) {
    if (vehicle.status === VehicleStatus.WAITING_FIELD_AGENT) {
      vehicle.battery = Math.max(0, vehicle.battery - Math.random() * WAITING_BATTERY_DRAIN * Math.sqrt(speedMultiplier));
      vehicle.lastUpdate = Date.now();
      return;
    }

    const routeStep = ROUTE_STEP_FACTOR * speedMultiplier;
    const driftStep = DRIFT_STEP_FACTOR * speedMultiplier;
    const headingStep = HEADING_STEP_FACTOR * Math.sqrt(speedMultiplier);

    if (vehicle.status === VehicleStatus.EN_ROUTE && vehicle.route && vehicle.route.length > 1) {
      const target = vehicle.route[1];
      const dx = target.lng - vehicle.location.lng;
      const dy = target.lat - vehicle.location.lat;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < routeStep) {
        vehicle.location.lat = target.lat;
        vehicle.location.lng = target.lng;
        vehicle.route.shift();
        if (vehicle.route.length === 1) {
          vehicle.status = VehicleStatus.WITH_CUSTOMER;
          vehicle.route = undefined;
          if (vehicle.activeTrip) {
            vehicle.activeTrip.startTime = Date.now();
          } else {
            vehicle.activeTrip = this.generateTrip(vehicle.location);
          }
        }
      } else {
        vehicle.location.lat += (dy / distance) * routeStep;
        vehicle.location.lng += (dx / distance) * routeStep;
        vehicle.heading = this.normalizeHeading(Math.atan2(dx, dy) * (180 / Math.PI));
      }
    }
    // FREE vehicles don't move - they stay parked

    vehicle.battery = Math.max(0, vehicle.battery - Math.random() * MOVING_BATTERY_DRAIN * Math.sqrt(speedMultiplier));
    vehicle.lastUpdate = Date.now();
  }
}
