import { Injectable } from '@nestjs/common';

type MetricKey =
  | 'wsConnections'
  | 'vehicleUpdatesEmitted'
  | 'tripRefreshEmitted'
  | 'dispatchCommands'
  | 'replaceAttempts'
  | 'replaceSuccess'
  | 'replaceFailures'
  | 'tripsGenerated'
  | 'bulkVehiclesAdded';

export interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class ObservabilityService {
  private readonly metrics: Record<MetricKey, number> = {
    wsConnections: 0,
    vehicleUpdatesEmitted: 0,
    tripRefreshEmitted: 0,
    dispatchCommands: 0,
    replaceAttempts: 0,
    replaceSuccess: 0,
    replaceFailures: 0,
    tripsGenerated: 0,
    bulkVehiclesAdded: 0,
  };
  private readonly audit: AuditEntry[] = [];
  private readonly maxAuditEntries = 500;

  increment(metric: MetricKey, by = 1) {
    this.metrics[metric] += by;
  }

  record(action: string, details?: Record<string, unknown>) {
    this.audit.unshift({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
    if (this.audit.length > this.maxAuditEntries) {
      this.audit.length = this.maxAuditEntries;
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getAudit(limit = 50) {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    return this.audit.slice(0, safeLimit);
  }
}
