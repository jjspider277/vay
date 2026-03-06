import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { IssueType, VehicleStatus } from './types';

describe('VehicleController', () => {
  const createController = () => {
    const vehicleService = {
      getVehicle: jest.fn(),
      getAllVehicles: jest.fn(() => []),
      getVehicleLogs: jest.fn(() => []),
      getCoverageAnalysis: jest.fn(() => []),
      getActiveTrips: jest.fn(() => []),
    };

    const tripService = {
      getAvailableTrips: jest.fn(() => []),
      getAllTrips: jest.fn(() => []),
      cancelTrip: jest.fn(),
      generateNewTrip: jest.fn(),
      assignTrip: jest.fn(),
    };

    const eventGenerator = {
      dispatchAgentToVehicle: jest.fn(),
      replaceVehicleForLowBattery: jest.fn(),
      addRandomVehicles: jest.fn(() => []),
      assignTripToVehicle: jest.fn(),
    };

    const vehicleGateway = {
      emitVehicleUpdate: jest.fn(),
      emitTripRefresh: jest.fn(),
    };

    const observability = {
      increment: jest.fn(),
      record: jest.fn(),
      getMetrics: jest.fn(() => ({})),
      getAudit: jest.fn(() => []),
    };

    return {
      controller: new VehicleController(
        vehicleService as any,
        tripService as any,
        eventGenerator as any,
        vehicleGateway as any,
        observability as any
      ),
      vehicleService,
      eventGenerator,
      vehicleGateway,
      observability,
    };
  };

  it('rejects dispatch when issue type is not allowed', () => {
    const { controller } = createController();

    expect(() =>
      controller.dispatchAgent('VEH-001', { issueType: IssueType.OTHER, notes: 'x' })
    ).toThrow(BadRequestException);
  });

  it('rejects battery-low dispatch if battery is not below threshold', () => {
    const { controller, vehicleService } = createController();
    vehicleService.getVehicle.mockReturnValue({
      id: 'VEH-001',
      battery: 45,
      status: VehicleStatus.FREE,
    });

    expect(() =>
      controller.dispatchAgent('VEH-001', { issueType: IssueType.BATTERY_LOW, notes: 'check' })
    ).toThrow(BadRequestException);
  });

  it('dispatches successfully for mechanical issue and emits update', () => {
    const { controller, vehicleService, eventGenerator, vehicleGateway, observability } = createController();
    const updatedVehicle = { id: 'VEH-001', battery: 55, status: VehicleStatus.WAITING_FIELD_AGENT };
    vehicleService.getVehicle.mockReturnValue(updatedVehicle);
    eventGenerator.dispatchAgentToVehicle.mockReturnValue({
      type: 'dispatch',
      vehicleId: 'VEH-001',
      data: updatedVehicle,
      timestamp: Date.now(),
    });

    const result = controller.dispatchAgent('VEH-001', {
      issueType: IssueType.MECHANICAL,
      notes: 'noise from rear axle',
    });

    expect(eventGenerator.dispatchAgentToVehicle).toHaveBeenCalledWith(
      'VEH-001',
      IssueType.MECHANICAL,
      'noise from rear axle'
    );
    expect(vehicleGateway.emitVehicleUpdate).toHaveBeenCalledTimes(1);
    expect(observability.increment).toHaveBeenCalledWith('dispatchCommands');
    expect(result).toEqual(updatedVehicle);
  });

  it('throws not found when vehicle does not exist', () => {
    const { controller, vehicleService } = createController();
    vehicleService.getVehicle.mockReturnValue(undefined);

    expect(() =>
      controller.dispatchAgent('VEH-404', { issueType: IssueType.MECHANICAL, notes: 'test' })
    ).toThrow(NotFoundException);
  });

  it('returns vehicle logs with filter passthrough', () => {
    const { controller, vehicleService } = createController();
    vehicleService.getVehicleLogs.mockReturnValue([{ id: '1', category: 'DISPATCH' }] as any);

    const logs = controller.getVehicleLogs('VEH-010', { category: 'DISPATCH' as any });

    expect(vehicleService.getVehicleLogs).toHaveBeenCalledWith('VEH-010', 'DISPATCH');
    expect(logs).toEqual([{ id: '1', category: 'DISPATCH' }]);
  });

  it('replaceWithClosestCar returns success payload when replacement is available', async () => {
    const { controller, vehicleService, eventGenerator } = createController();
    vehicleService.getVehicle.mockReturnValue({ id: 'VEH-001', battery: 10, activeTrip: { tripId: 'TRIP-1' } });
    eventGenerator.replaceVehicleForLowBattery.mockResolvedValue({
      ok: true,
      replacedVehicleEvent: { type: 'dispatch', vehicleId: 'VEH-001', data: {}, timestamp: Date.now() },
      replacementVehicleEvent: { type: 'trip_assignment', vehicleId: 'VEH-010', data: {}, timestamp: Date.now() },
      replacementVehicleId: 'VEH-010',
      etaMinutes: 4,
    });

    const result = await controller.replaceWithClosestCar('VEH-001');
    expect(result).toEqual({ success: true, replacementVehicleId: 'VEH-010', etaMinutes: 4 });
  });

  it('replaceWithClosestCar throws no-free-vehicle message with free count', async () => {
    const { controller, vehicleService, eventGenerator } = createController();
    vehicleService.getVehicle.mockReturnValue({ id: 'VEH-001', battery: 10, activeTrip: { tripId: 'TRIP-1' } });
    vehicleService.getAllVehicles.mockReturnValue(
      [{ status: VehicleStatus.FREE }, { status: VehicleStatus.EN_ROUTE }] as any
    );
    eventGenerator.replaceVehicleForLowBattery.mockResolvedValue({ ok: false, reason: 'NO_FREE_VEHICLE' });

    await expect(controller.replaceWithClosestCar('VEH-001')).rejects.toThrow(
      'No available idle vehicle to replace this car. Current FREE vehicles: 1.'
    );
  });

  it('replaceWithClosestCar throws retry message when source vehicle is not ready', async () => {
    const { controller, vehicleService, eventGenerator } = createController();
    vehicleService.getVehicle.mockReturnValue({ id: 'VEH-001', battery: 10, activeTrip: { tripId: 'TRIP-1' } });
    eventGenerator.replaceVehicleForLowBattery.mockResolvedValue({ ok: false, reason: 'SOURCE_VEHICLE_NOT_READY' });

    await expect(controller.replaceWithClosestCar('VEH-001')).rejects.toThrow(
      'Vehicle state is not ready in event stream yet. Retry in a few seconds.'
    );
  });
});
