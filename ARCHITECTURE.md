# Fleet Radar Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLEET RADAR SYSTEM                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   Event Generator    │         │   React Frontend     │
│   (Mock Kafka)       │         │   (Port 3000)        │
│                      │         │                      │
│  - 100 Vehicles      │         │  - Leaflet Map       │
│  - Telemetry Events  │         │  - Real-time Updates │
│  - Route Events      │         │  - Filtering         │
│  - 1s Intervals      │         │  - Vehicle Details   │
└──────────┬───────────┘         └──────────▲───────────┘
           │                                │
           │ Events                         │ WebSocket
           │                                │
           ▼                                │
┌─────────────────────────────────────────────────────┐
│              NestJS Backend (Port 3001)             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │ VehicleService   │      │ VehicleGateway   │   │
│  │                  │      │                  │   │
│  │ - Event Consumer │◄─────┤ - Socket.IO      │   │
│  │ - State Store    │      │ - Broadcast      │   │
│  │ - Map<id,Vehicle>│      │ - Initial Load   │   │
│  └──────────────────┘      └──────────────────┘   │
│                                                     │
│  ┌──────────────────┐                              │
│  │ VehicleController│                              │
│  │                  │                              │
│  │ - REST API       │                              │
│  │ - GET /vehicles  │                              │
│  └──────────────────┘                              │
└─────────────────────────────────────────────────────┘
```

## Data Flow

```
1. Event Generation (Simulating Kafka)
   ┌─────────────────────────────────────────┐
   │ EventGenerator.generateEvents()         │
   │ - Select random vehicles                │
   │ - Update position, battery, status      │
   │ - Generate route if EN_ROUTE            │
   │ - Emit event every 1s                   │
   └─────────────────┬───────────────────────┘
                     │
                     ▼
2. Event Consumption
   ┌─────────────────────────────────────────┐
   │ VehicleService.processEvent()           │
   │ - Update in-memory state                │
   │ - vehicles.set(id, vehicleData)         │
   └─────────────────┬───────────────────────┘
                     │
                     ▼
3. Real-time Broadcast
   ┌─────────────────────────────────────────┐
   │ VehicleGateway                          │
   │ - server.emit('vehicle-update', data)   │
   │ - Push to all connected clients         │
   └─────────────────┬───────────────────────┘
                     │
                     ▼
4. Frontend Update
   ┌─────────────────────────────────────────┐
   │ React App                               │
   │ - socket.on('vehicle-update')           │
   │ - Update local state                    │
   │ - Re-render map markers                 │
   └─────────────────────────────────────────┘
```

## Component Interaction

```
Frontend Components:
┌────────────────────────────────────────────────────┐
│                      App.tsx                       │
│  - WebSocket connection                            │
│  - Global state (vehicles Map)                     │
│  - Filter state                                    │
└───┬────────────────┬────────────────┬──────────────┘
    │                │                │
    ▼                ▼                ▼
┌─────────┐   ┌──────────┐   ┌──────────────┐
│ Filter  │   │ FleetMap │   │ VehicleDetails│
│ Panel   │   │          │   │              │
│         │   │ - Leaflet│   │ - Selected   │
│ - Status│   │ - Markers│   │   vehicle    │
│ - Battery   │ - Routes │   │ - Battery    │
└─────────┘   └──────────┘   └──────────────┘
```

## Event Structure

```typescript
// Telemetry Event (from EventGenerator)
{
  type: 'telemetry',
  vehicleId: 'VEH-042',
  data: {
    id: 'VEH-042',
    location: { lat: 52.5234, lng: 13.4102 },
    heading: 145.3,
    battery: 67.2,
    status: 'EN_ROUTE',
    route: [
      { lat: 52.5234, lng: 13.4102 },
      { lat: 52.5245, lng: 13.4115 },
      ...
    ],
    lastUpdate: 1704123456789
  },
  timestamp: 1704123456789
}
```

## State Management

```
Backend (In-Memory):
┌─────────────────────────────────────┐
│ Map<vehicleId, Vehicle>             │
├─────────────────────────────────────┤
│ 'VEH-001' → { id, location, ... }   │
│ 'VEH-002' → { id, location, ... }   │
│ ...                                 │
│ 'VEH-100' → { id, location, ... }   │
└─────────────────────────────────────┘

Frontend (React State):
┌─────────────────────────────────────┐
│ Map<vehicleId, Vehicle>             │
├─────────────────────────────────────┤
│ Updated via setVehicles() on:       │
│ - Initial connection (all vehicles) │
│ - WebSocket update (single vehicle) │
└─────────────────────────────────────┘
```

## Scaling Architecture (1000 Vehicles)

```
┌──────────────┐
│   Clients    │
│  (Browsers)  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│   Load Balancer      │
│   (AWS ALB/NGINX)    │
└──────┬───────────────┘
       │
       ├─────────┬─────────┬─────────┐
       ▼         ▼         ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │NestJS 1│ │NestJS 2│ │NestJS 3│
   └───┬────┘ └───┬────┘ └───┬────┘
       │          │          │
       └──────────┼──────────┘
                  ▼
         ┌────────────────┐
         │  Redis Pub/Sub │
         │  (State Sync)  │
         └────────┬───────┘
                  │
                  ▼
         ┌────────────────┐
         │   PostgreSQL   │
         │   + PostGIS    │
         │  (Persistence) │
         └────────────────┘
                  ▲
                  │
         ┌────────┴───────┐
         │  Kafka Cluster │
         │  (Real Events) │
         └────────────────┘
```
