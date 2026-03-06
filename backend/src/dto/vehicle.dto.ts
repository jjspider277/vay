import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_BULK_ADD_COUNT, MAX_BULK_ADD_COUNT, MIN_BULK_ADD_COUNT } from '../constants';
import { IssueType, VehicleLogCategory } from '../types';

export class DispatchAgentDto {
  @IsEnum(IssueType)
  issueType!: IssueType;

  @IsString()
  @IsNotEmpty()
  notes!: string;
}

export class BulkRandomVehiclesDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(MIN_BULK_ADD_COUNT)
  @Max(MAX_BULK_ADD_COUNT)
  count: number = DEFAULT_BULK_ADD_COUNT;
}

export class VehicleLogsQueryDto {
  @IsOptional()
  @IsIn(['SYSTEM', 'STATUS', 'BATTERY', 'TRIP', 'DISPATCH', 'TELEMETRY'])
  category?: VehicleLogCategory;
}

export class GenerateTripDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customerName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dropoffAddress?: string;
}
