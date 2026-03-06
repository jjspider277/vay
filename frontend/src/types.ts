export enum VehicleStatus {
  FREE = 'FREE',
  WITH_CUSTOMER = 'WITH_CUSTOMER',
  EN_ROUTE = 'EN_ROUTE',
  WAITING_FIELD_AGENT = 'WAITING_FIELD_AGENT'
}

export enum IssueType {
  BATTERY_LOW = 'BATTERY_LOW',
  MECHANICAL = 'MECHANICAL',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  ACCIDENT = 'ACCIDENT',
  OTHER = 'OTHER'
}

export interface Location {
  lat: number;
  lng: number;
}

export interface AgentDispatch {
  issueType: IssueType;
  notes: string;
  timestamp: number;
  agentId?: string;
}

export interface Trip {
  tripId: string;
  customerId: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  pickupAddress: string;
  dropoffAddress: string;
  startTime: number;
  estimatedDuration: number;
}

export interface Vehicle {
  id: string;
  location: Location;
  heading: number;
  battery: number;
  status: VehicleStatus;
  route?: Location[];
  lastUpdate: number;
  agentDispatched?: AgentDispatch;
  activeTrip?: Trip;
}

export type VehicleLogCategory =
  | 'SYSTEM'
  | 'STATUS'
  | 'BATTERY'
  | 'TRIP'
  | 'DISPATCH'
  | 'TELEMETRY';

export interface VehicleLog {
  id: string;
  vehicleId: string;
  category: VehicleLogCategory;
  message: string;
  timestamp: number;
  eventType: 'telemetry' | 'route' | 'dispatch' | 'trip_assignment';
}
