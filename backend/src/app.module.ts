import { Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { VehicleGateway } from './vehicle.gateway';
import { EventGenerator } from './event-generator';
import { TripService } from './trip.service';
import { ObservabilityService } from './observability.service';

@Module({
  controllers: [VehicleController],
  providers: [VehicleService, VehicleGateway, EventGenerator, TripService, ObservabilityService],
})
export class AppModule {}
