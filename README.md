# Fleet Radar (Full-Stack Prototype)

A real-time operations dashboard for monitoring ~100 remote EVs.

This prototype is optimized for the assignment goals:
- event-driven backend design
- live vehicle state updates
- operator-focused UX over visual polish
- pragmatic local setup (in-memory, no auth)

## What it does

- Shows ~100 vehicles on a live map
- Tracks vehicle telemetry in real time:
  - location (`lat/lng`)
  - heading
  - battery
  - status (`FREE`, `WITH_CUSTOMER`, `EN_ROUTE`)
- Renders route lines for `EN_ROUTE` vehicles
- Supports operator workflows:
  - status + low-battery filtering
  - stale vehicle indicator in details panel
  - coverage heatmap overlay
  - dispatch field agent to selected vehicle
  - create trip requests and assign to a vehicle

## Tech stack

- Backend: NestJS + Socket.IO + TypeScript
- Frontend: React + TypeScript + Leaflet
- Storage: in-memory maps
- Event source: simulated producer (Kafka-like ingestion model)

## Run locally

Prerequisites:
- Node.js 18+
- pnpm

### 1) Backend

```bash
cd backend
pnpm install
pnpm start
```

Backend URL: `http://localhost:3001`

Optional environment variable:
- `GOOGLE_MAPS_API_KEY`: Google Routes API key for real road routes.
  - If missing, backend uses synthetic fallback routes.
- `FLEET_SIZE`: number of vehicles created at startup (default: `6`)
- `TELEMETRY_TICK_MS`: telemetry publish interval in milliseconds (default: `15000`)
- `SIMULATION_SPEED_MULTIPLIER`: simulation acceleration factor (default: `30`)
- `CORS_ORIGINS`: comma-separated CORS allowlist (default: `http://localhost:3000,http://127.0.0.1:3000`)

Example:
```bash
export GOOGLE_MAPS_API_KEY="your-google-routes-api-key"
export FLEET_SIZE=6
export TELEMETRY_TICK_MS=15000
export SIMULATION_SPEED_MULTIPLIER=30
```

### 2) Frontend

```bash
cd frontend
pnpm install
pnpm start
```

Frontend URL: `http://localhost:3000`

## Fast verification

In separate terminals:

```bash
cd backend && pnpm typecheck
cd frontend && pnpm typecheck
```

Open `http://localhost:3000` and verify:
- vehicles move continuously
- `EN_ROUTE` vehicles show route polyline
- selecting a vehicle shows live details and stale timer
- coverage overlay refreshes while enabled
- creating + assigning trip changes vehicle state live

## Architecture and data flow (~100 vehicles)

### Event-driven backend model

The backend is structured as if Kafka were the source of truth.

1. **Producer simulation** (`EventGenerator`)
- emits telemetry events continuously
- emits command-driven events (trip assignment, agent dispatch)

2. **Event projection** (`VehicleService`)
- consumes events
- merges partial event payloads into current vehicle read model
- guards against stale/out-of-order events using timestamps

3. **Realtime fanout** (`VehicleGateway`)
- broadcasts projected state changes via WebSocket (`vehicle-update`)
- emits trip refresh signals (`trip-updated`) for request panels

4. **Operator commands** (`VehicleController`)
- REST endpoints for dispatch and trip actions
- commands produce events through the same event path

### Frontend data model

- Maintains a normalized `Map<vehicleId, Vehicle>` state
- Applies websocket updates incrementally
- Derives filtered map view client-side
- Uses polling + socket signal for trip request freshness

## Timebox tradeoffs

1. **In-memory state over persistence**
- Chosen for speed and simplicity.
- Tradeoff: state resets on restart.

2. **Single-node event loop over real Kafka**
- Chosen to demonstrate event patterns without infra overhead.
- Tradeoff: no partitioning/consumer groups in prototype.

3. **Full-object vehicle updates over compact diffs**
- Chosen for implementation clarity.
- Tradeoff: higher payload size than strict delta transport.

4. **Client-side filtering over server viewport queries**
- Chosen for fast UX iteration.
- Tradeoff: would not scale as efficiently for very large fleets.

## How this scales to ~1000 vehicles (design discussion)

Backend:
- replace simulated producer with Kafka topics (`telemetry`, `route_updates`, `ops_commands`)
- consumer groups + partitioning by `vehicleId`
- Redis-backed hot projection and pub/sub fanout
- persist historical events/state in Postgres + PostGIS

Realtime delivery:
- shard websocket gateways
- use Redis adapter for cross-instance socket fanout
- emit compact diffs / coalesced update batches

Frontend:
- viewport-based subscriptions
- marker clustering + selective detail rendering
- throttled render pipeline (batch updates per frame)

Ops:
- metrics (event lag, dropped updates, ws fanout latency)
- dead-letter handling for malformed events
- replay tooling for incident debugging
