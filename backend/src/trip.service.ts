/**
 * This is entirely a mock implementation of a trip management service for demonstration purposes. 
 * It generates random trips within Las Vegas and allows basic operations like creating, retrieving, assigning,
 * and updating trips. In a real application, this would be backed by a database and include more complex business 
 * logic and error handling.
 */
import { Injectable } from '@nestjs/common';
import { LOG_ID_RANDOM_SPACE } from './constants';
import { Location } from './types';

export interface TripRequest {
  tripId: string;
  customerId: string;
  customerName: string;
  pickupLocation: Location;
  pickupAddress: string;
  dropoffLocation: Location;
  dropoffAddress: string;
  requestTime: number;
  status: 'REQUESTED' | 'ASSIGNED' | 'PICKUP' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedVehicleId?: string;
}

export interface CreateTripPayload {
  customerName?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
}

@Injectable()
export class TripService {
  private trips: Map<string, TripRequest> = new Map();
  private readonly CUSTOMER_NAMES = [
    'John Smith', 'Emma Johnson', 'Michael Brown', 'Sarah Davis',
    'James Wilson', 'Lisa Anderson', 'David Martinez', 'Jennifer Taylor',
    'Robert Thomas', 'Mary Garcia', 'William Rodriguez', 'Patricia Lee'
  ];

  private readonly LAS_VEGAS_LOCATIONS = [
    { name: 'Bellagio Hotel', lat: 36.1129, lng: -115.1765 },
    { name: 'MGM Grand', lat: 36.1024, lng: -115.1699 },
    { name: 'Caesars Palace', lat: 36.1162, lng: -115.1745 },
    { name: 'The Venetian', lat: 36.1212, lng: -115.1697 },
    { name: 'Luxor Hotel', lat: 36.0955, lng: -115.1761 },
    { name: 'Mandalay Bay', lat: 36.0909, lng: -115.1744 },
    { name: 'Wynn Las Vegas', lat: 36.1271, lng: -115.1656 },
    { name: 'Aria Resort', lat: 36.1067, lng: -115.1765 },
    { name: 'Paris Las Vegas', lat: 36.1125, lng: -115.1708 },
    { name: 'New York New York', lat: 36.1023, lng: -115.1740 },
    { name: 'McCarran Airport', lat: 36.0840, lng: -115.1537 },
    { name: 'Fremont Street', lat: 36.1699, lng: -115.1398 },
    { name: 'Las Vegas Convention Center', lat: 36.1329, lng: -115.1534 },
    { name: 'T-Mobile Arena', lat: 36.1029, lng: -115.1784 },
    { name: 'Fashion Show Mall', lat: 36.1275, lng: -115.1726 },
    { name: 'Excalibur', lat: 36.0985, lng: -115.1758 },
    { name: 'Mirage', lat: 36.1213, lng: -115.1742 },
    { name: 'Treasure Island', lat: 36.1247, lng: -115.1722 },
    { name: 'Circus Circus', lat: 36.1368, lng: -115.1639 },
    { name: 'Stratosphere', lat: 36.1475, lng: -115.1566 },
    { name: 'Downtown Las Vegas', lat: 36.1699, lng: -115.1398 },
    { name: 'Allegiant Stadium', lat: 36.0909, lng: -115.1833 },
    { name: 'UNLV', lat: 36.1085, lng: -115.1469 },
  ];

  generateNewTrip(payload?: CreateTripPayload): TripRequest | null {
    return this.generateTripRequest(payload);
  }

  private getLocationByName(name?: string) {
    if (!name) {
      return undefined;
    }
    return this.LAS_VEGAS_LOCATIONS.find(location => location.name === name);
  }

  private randomLocation() {
    return this.LAS_VEGAS_LOCATIONS[Math.floor(Math.random() * this.LAS_VEGAS_LOCATIONS.length)];
  }

  private generateTripRequest(payload?: CreateTripPayload): TripRequest | null {
    let pickup = this.getLocationByName(payload?.pickupAddress) ?? this.randomLocation();
    let dropoff = this.getLocationByName(payload?.dropoffAddress) ?? this.randomLocation();

    if (pickup.name === dropoff.name) {
      const alternatives = this.LAS_VEGAS_LOCATIONS.filter(location => location.name !== pickup.name);
      dropoff = alternatives[Math.floor(Math.random() * alternatives.length)];
    }

    const trip: TripRequest = {
      tripId: `TRIP-${Date.now()}-${Math.floor(Math.random() * LOG_ID_RANDOM_SPACE)}`,
      customerId: `CUST-${Math.floor(Math.random() * LOG_ID_RANDOM_SPACE * 10)}`,
      customerName: payload?.customerName?.trim() || this.CUSTOMER_NAMES[Math.floor(Math.random() * this.CUSTOMER_NAMES.length)],
      pickupLocation: { lat: pickup.lat, lng: pickup.lng },
      pickupAddress: pickup.name,
      dropoffLocation: { lat: dropoff.lat, lng: dropoff.lng },
      dropoffAddress: dropoff.name,
      requestTime: Date.now(),
      status: 'REQUESTED'
    };

    this.trips.set(trip.tripId, trip);
    return trip;
  }

  getAvailableTrips(): TripRequest[] {
    return Array.from(this.trips.values()).filter(t => t.status === 'REQUESTED');
  }

  getAllTrips(): TripRequest[] {
    return Array.from(this.trips.values());
  }

  getTripById(tripId: string): TripRequest | undefined {
    return this.trips.get(tripId);
  }

  assignTrip(tripId: string, vehicleId: string): TripRequest | null {
    const trip = this.trips.get(tripId);
    if (!trip || trip.status !== 'REQUESTED') {
      return null;
    }

    trip.status = 'ASSIGNED';
    trip.assignedVehicleId = vehicleId;
    return trip;
  }

  updateTripStatus(tripId: string, status: TripRequest['status']) {
    const trip = this.trips.get(tripId);
    if (trip) {
      trip.status = status;
    }
  }

  cancelTrip(tripId: string) {
    const trip = this.trips.get(tripId);
    if (trip) {
      trip.status = 'CANCELLED';
    }
  }
}
