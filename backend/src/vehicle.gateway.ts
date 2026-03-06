import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { VehicleService } from './vehicle.service';
import { EventGenerator } from './event-generator';
import { VehicleEvent, Vehicle } from './types';
import { ObservabilityService } from './observability.service';

@WebSocketGateway({ cors: true })
export class VehicleGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private vehicleService: VehicleService,
    private eventGenerator: EventGenerator,
    private observability: ObservabilityService,
  ) {
    this.seedProjection();
    this.startEventConsumer();
  }

  handleConnection(client: Socket) {
    this.observability.increment('wsConnections');
    client.emit('initial', this.vehicleService.getAllVehicles());
  }

  emitVehicleUpdate(event: VehicleEvent) {
    const mergedVehicle = this.vehicleService.processEvent(event);
    if (mergedVehicle) {
      this.server.emit('vehicle-update', mergedVehicle);
      this.observability.increment('vehicleUpdatesEmitted');
    }
  }

  emitTripRefresh() {
    this.server.emit('trip-updated', { timestamp: Date.now() });
    this.observability.increment('tripRefreshEmitted');
  }

  private startEventConsumer() {
    this.eventGenerator.generateEvents((event: VehicleEvent) => {
      this.emitVehicleUpdate(event);
    });
  }

  private seedProjection() {
    const now = Date.now();
    this.eventGenerator.getAllVehicles().forEach((vehicle: Vehicle) => {
      this.vehicleService.processEvent({
        type: 'telemetry',
        vehicleId: vehicle.id,
        data: vehicle,
        timestamp: now
      });
    });
  }
}
