import { Controller, Get, Post, Body, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { TripService } from './trip.service';
import { IssueType, Location, VehicleStatus } from './types';
import { EventGenerator } from './event-generator';
import { VehicleGateway } from './vehicle.gateway';
import { DEFAULT_BULK_ADD_COUNT, LOW_BATTERY_THRESHOLD } from './constants';
import { calculateDistanceKm } from './utils/geo';
import { BulkRandomVehiclesDto, DispatchAgentDto, GenerateTripDto, VehicleLogsQueryDto } from './dto/vehicle.dto';
import { ObservabilityService } from './observability.service';

@Controller('api')
export class VehicleController {
  constructor(
    private vehicleService: VehicleService,
    private tripService: TripService,
    private eventGenerator: EventGenerator,
    private vehicleGateway: VehicleGateway,
    private observability: ObservabilityService,
  ) {}

  @Get('vehicles')
  getAllVehicles() {
    return this.vehicleService.getAllVehicles();
  }

  @Get('vehicles/:id/logs')
  getVehicleLogs(
    @Param('id') vehicleId: string,
    @Query() query: VehicleLogsQueryDto
  ) {
    return this.vehicleService.getVehicleLogs(vehicleId, query.category);
  }

  @Get('ops/metrics')
  getOpsMetrics() {
    return this.observability.getMetrics();
  }

  @Get('ops/audit')
  getOpsAudit(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.observability.getAudit(parsed);
  }

  @Post('vehicles/:id/dispatch-agent')
  dispatchAgent(
    @Param('id') vehicleId: string,
    @Body() body: DispatchAgentDto
  ) {
    const allowedIssueTypes = [IssueType.BATTERY_LOW, IssueType.MECHANICAL];
    if (!allowedIssueTypes.includes(body.issueType)) {
      throw new BadRequestException('Dispatch agent is allowed only for low battery or mechanical malfunction');
    }

    const vehicle = this.vehicleService.getVehicle(vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (body.issueType === IssueType.BATTERY_LOW && vehicle.battery >= LOW_BATTERY_THRESHOLD) {
      throw new BadRequestException(`Battery-low dispatch requires battery below ${LOW_BATTERY_THRESHOLD}%`);
    }

    const event = this.eventGenerator.dispatchAgentToVehicle(vehicleId, body.issueType, body.notes.trim());
    if (!event) {
      throw new NotFoundException('Vehicle not found');
    }

    this.vehicleGateway.emitVehicleUpdate(event);
    this.observability.increment('dispatchCommands');
    this.observability.record('dispatch_agent', { vehicleId, issueType: body.issueType });
    return this.vehicleService.getVehicle(vehicleId);
  }

  @Post('vehicles/:id/replace-with-closest')
  async replaceWithClosestCar(@Param('id') vehicleId: string) {
    this.observability.increment('replaceAttempts');
    const vehicle = this.vehicleService.getVehicle(vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (!vehicle.activeTrip) {
      throw new BadRequestException('Vehicle has no active trip');
    }

    if (vehicle.battery >= LOW_BATTERY_THRESHOLD) {
      throw new BadRequestException(`Vehicle battery is not below ${LOW_BATTERY_THRESHOLD}%`);
    }

    const result = await this.eventGenerator.replaceVehicleForLowBattery(vehicleId);
    if (!result.ok) {
      if (result.reason === 'SOURCE_VEHICLE_NOT_READY') {
        this.observability.increment('replaceFailures');
        this.observability.record('replace_failed', { vehicleId, reason: result.reason });
        throw new BadRequestException('Vehicle state is not ready in event stream yet. Retry in a few seconds.');
      }

      const freeCount = this.vehicleService
        .getAllVehicles()
        .filter(candidate => candidate.status === VehicleStatus.FREE).length;
      this.observability.increment('replaceFailures');
      this.observability.record('replace_failed', { vehicleId, reason: result.reason, freeCount });
      throw new BadRequestException(
        `No available idle vehicle to replace this car. Current FREE vehicles: ${freeCount}.`
      );
    }

    this.vehicleGateway.emitVehicleUpdate(result.replacedVehicleEvent);
    this.vehicleGateway.emitVehicleUpdate(result.replacementVehicleEvent);
    this.vehicleGateway.emitTripRefresh();
    this.observability.increment('replaceSuccess');
    this.observability.record('replace_success', {
      vehicleId,
      replacementVehicleId: result.replacementVehicleId,
      etaMinutes: result.etaMinutes
    });

    return {
      success: true,
      replacementVehicleId: result.replacementVehicleId,
      etaMinutes: result.etaMinutes
    };
  }

  @Post('vehicles/bulk-random')
  addRandomVehicles(@Body() body: BulkRandomVehiclesDto) {
    const count = Number(body.count ?? DEFAULT_BULK_ADD_COUNT);
    const events = this.eventGenerator.addRandomVehicles(count);
    events.forEach(event => this.vehicleGateway.emitVehicleUpdate(event));
    this.observability.increment('bulkVehiclesAdded', events.length);
    this.observability.record('bulk_add', { requested: count, added: events.length });

    return {
      success: true,
      added: events.length,
      vehicleIds: events.map(event => event.vehicleId)
    };
  }

  @Get('coverage-analysis')
  getCoverageAnalysis() {
    return this.vehicleService.getCoverageAnalysis();
  }

  @Get('active-trips')
  getActiveTrips() {
    return this.vehicleService.getActiveTrips();
  }

  @Get('trip-requests')
  getTripRequests() {
    return this.tripService.getAvailableTrips();
  }

  @Get('all-trips')
  getAllTrips() {
    return this.tripService.getAllTrips();
  }

  @Post('trips/:tripId/cancel')
  cancelTrip(@Param('tripId') tripId: string) {
    this.tripService.cancelTrip(tripId);
    this.vehicleGateway.emitTripRefresh();
    return { success: true };
  }

  /**
   * Creates a customer trip and immediately auto-assigns the closest FREE vehicle when possible.
   * Keeps trip creation and assignment separated so the flow can degrade gracefully under low supply.
   */
  @Post('trips/generate')
  async generateTrip(@Body() payload: GenerateTripDto) {
    const trip = this.tripService.generateNewTrip(payload);
    if (!trip) {
      throw new BadRequestException('Unable to generate trip');
    }

    const closestVehicle = this.findClosestIdleVehicle(trip.pickupLocation);
    if (closestVehicle) {
      const assignedTrip = this.tripService.assignTrip(trip.tripId, closestVehicle.id);
      if (assignedTrip) {
        const event = await this.eventGenerator.assignTripToVehicle(closestVehicle.id, {
          tripId: assignedTrip.tripId,
          customerId: assignedTrip.customerId,
          pickupLocation: assignedTrip.pickupLocation,
          pickupAddress: assignedTrip.pickupAddress,
          dropoffLocation: assignedTrip.dropoffLocation,
          dropoffAddress: assignedTrip.dropoffAddress,
        });

        if (event) {
          this.vehicleGateway.emitVehicleUpdate(event);
        }

        this.vehicleGateway.emitTripRefresh();
        this.observability.increment('tripsGenerated');
        this.observability.record('trip_generated', {
          tripId: assignedTrip.tripId,
          autoAssigned: true,
          vehicleId: closestVehicle.id
        });
        return {
          success: true,
          trip: assignedTrip,
          autoAssigned: true,
          vehicleId: closestVehicle.id,
        };
      }
    }

    this.vehicleGateway.emitTripRefresh();
    this.observability.increment('tripsGenerated');
    this.observability.record('trip_generated', { tripId: trip.tripId, autoAssigned: false });
    return { success: true, trip, autoAssigned: false };
  }

  /**
   * Linear nearest-neighbor search over FREE vehicles.
   * O(n) is acceptable for this prototype and keeps logic explicit for review interviews.
   */
  private findClosestIdleVehicle(pickup: Location) {
    const idleVehicles = this.vehicleService
      .getAllVehicles()
      .filter(vehicle => vehicle.status === VehicleStatus.FREE);

    if (idleVehicles.length === 0) {
      return null;
    }

    let closest = idleVehicles[0];
    let minDistance = calculateDistanceKm(closest.location, pickup);

    for (let i = 1; i < idleVehicles.length; i++) {
      const candidate = idleVehicles[i];
      const distance = calculateDistanceKm(candidate.location, pickup);
      if (distance < minDistance) {
        minDistance = distance;
        closest = candidate;
      }
    }

    return closest;
  }
}
