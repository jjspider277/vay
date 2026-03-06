import { useEffect, useState, useMemo, useCallback } from "react";
import {
	Vehicle,
	IssueType,
	VehicleStatus,
	VehicleLog,
	VehicleLogCategory,
} from "./types";
import {
	API_BASE_URL,
	LOW_BATTERY_THRESHOLD,
	MS_PER_MINUTE,
	MS_PER_SECOND,
	STALE_SIGNAL_THRESHOLD_MS,
} from "./constants";

interface VehicleDetailsProps {
	vehicle: Vehicle;
	onClose: () => void;
	onDispatchAgent: () => void;
	onReplaceWithClosestCar: () => void;
	onOpenCustomerChat: () => void;
	actionBusy?: boolean;
}

type DetailsTab = "GENERAL" | "LOGS";
type LogFilter = "ALL" | VehicleLogCategory;

const VehicleDetails = ({
	vehicle,
	onClose,
	onDispatchAgent,
	onReplaceWithClosestCar,
	onOpenCustomerChat,
	actionBusy = false,
}: VehicleDetailsProps) => {
	const [activeTab, setActiveTab] = useState<DetailsTab>("GENERAL");
	const [logFilter, setLogFilter] = useState<LogFilter>("ALL");
	const [logs, setLogs] = useState<VehicleLog[]>([]);
	const [loadingLogs, setLoadingLogs] = useState(false);
	const [logRefreshToken, setLogRefreshToken] = useState(0);

	const timeSinceUpdate = useMemo(
		() => Math.floor((Date.now() - vehicle.lastUpdate) / MS_PER_SECOND),
		[vehicle.lastUpdate],
	);
	const isStale = timeSinceUpdate > STALE_SIGNAL_THRESHOLD_MS / MS_PER_SECOND;
	const canRecoverTrip =
		!!vehicle.activeTrip && vehicle.battery < LOW_BATTERY_THRESHOLD;
	const canDispatchAgent =
		vehicle.battery < LOW_BATTERY_THRESHOLD ||
		vehicle.status === VehicleStatus.WAITING_FIELD_AGENT;

	const formatIssueType = useCallback((type: IssueType) => {
		return type
			.replace("_", " ")
			.toLowerCase()
			.replace(/\b\w/g, (l) => l.toUpperCase());
	}, []);

	useEffect(() => {
		setActiveTab("GENERAL");
		setLogFilter("ALL");
		setLogs([]);
	}, [vehicle.id]);

	useEffect(() => {
		if (activeTab !== "LOGS") {
			return;
		}

		const controller = new AbortController();
		const fetchLogs = async () => {
			setLoadingLogs(true);
			try {
				const query =
					logFilter === "ALL"
						? ""
						: `?category=${encodeURIComponent(logFilter)}`;
				const response = await fetch(
					`${API_BASE_URL}/api/vehicles/${vehicle.id}/logs${query}`,
					{
						signal: controller.signal,
					},
				);
				if (response.ok) {
					const payload: VehicleLog[] = await response.json();
					setLogs(payload);
				}
			} catch {
				// Ignore fetch interruption/errors for operator console.
			} finally {
				setLoadingLogs(false);
			}
		};

		fetchLogs();
		return () => controller.abort();
	}, [activeTab, vehicle.id, logFilter, logRefreshToken]);

	return (
		<div className="vehicle-details">
			<div className="details-header">
				<h3>{vehicle.id}</h3>
				<button onClick={onClose}>×</button>
			</div>

			<div className="details-tabs">
				<button
					className={activeTab === "GENERAL" ? "active" : ""}
					onClick={() => setActiveTab("GENERAL")}
				>
					General
				</button>
				<button
					className={activeTab === "LOGS" ? "active" : ""}
					onClick={() => setActiveTab("LOGS")}
				>
					Telemetry
				</button>
			</div>

			<div className="details-content">
				{activeTab === "GENERAL" && (
					<>
						<div className="details-priority-row">
							{vehicle.battery < LOW_BATTERY_THRESHOLD && (
								<span className="priority-chip critical">LOW BATTERY</span>
							)}
							{isStale && (
								<span className="priority-chip warning">STALE SIGNAL</span>
							)}
							{vehicle.agentDispatched && (
								<span className="priority-chip info">AGENT ACTIVE</span>
							)}
							{vehicle.status === VehicleStatus.WAITING_FIELD_AGENT && (
								<span className="priority-chip waiting">
									WAITING FIELD AGENT
								</span>
							)}
						</div>

						<div className="detail-row">
							<span className="detail-label">Status</span>
							<strong className="status-pill detail-value">
								{vehicle.status}
							</strong>
						</div>

						<div className="detail-row detail-row-battery">
							<span className="detail-label">Battery</span>
							<div className="battery-bar detail-value">
								<div
									className="battery-fill"
									style={{
										width: `${vehicle.battery}%`,
										background:
											vehicle.battery < LOW_BATTERY_THRESHOLD
												? "#ef4444"
												: vehicle.battery < 50
													? "#f59e0b"
													: "#22c55e",
									}}
								/>
								<span className="battery-text">
									{Math.round(vehicle.battery)}%
								</span>
							</div>
						</div>
						{vehicle.battery < LOW_BATTERY_THRESHOLD && (
							<div className="low-battery-banner">
								Low Battery Alert: Vehicle battery is below{" "}
								{LOW_BATTERY_THRESHOLD}%. Prioritize charging or dispatch
								support.
							</div>
						)}

						<div className="detail-row">
							<span className="detail-label">Location</span>
							<span className="detail-value">
								{vehicle.location.lat.toFixed(4)},{" "}
								{vehicle.location.lng.toFixed(4)}
							</span>
						</div>

						<div className="detail-row">
							<span className="detail-label">Heading</span>
							<span className="detail-value">
								{Math.round(vehicle.heading)}°
							</span>
						</div>

						<div className="detail-row">
							<span className="detail-label">Last Update</span>
							<span className={`detail-value ${isStale ? "stale" : ""}`}>
								{timeSinceUpdate}s ago {isStale && "⚠️"}
							</span>
						</div>

						{vehicle.route && (
							<div className="detail-row">
								<span className="detail-label">Route Points</span>
								<span className="detail-value">{vehicle.route.length}</span>
							</div>
						)}
						{!vehicle.route && (
							<div className="detail-row">
								<span className="detail-label">Route</span>
								<span className="detail-value">
									Visible when vehicle is EN_ROUTE
								</span>
							</div>
						)}

						{vehicle.activeTrip && (
							<div className="trip-details">
								<h4>Active Trip</h4>
								<div className="detail-row">
									<span className="detail-label">From</span>
									<span className="detail-value">
										{vehicle.activeTrip.pickupAddress || "Pickup Location"}
									</span>
								</div>
								<div className="detail-row">
									<span className="detail-label">To</span>
									<span className="detail-value">
										{vehicle.activeTrip.dropoffAddress || "Dropoff Location"}
									</span>
								</div>
								<div className="detail-row">
									<span className="detail-label">Trip ID</span>
									<span className="detail-value detail-mono">
										{vehicle.activeTrip.tripId}
									</span>
								</div>
								<div className="detail-row">
									<span className="detail-label">Customer</span>
									<span className="detail-value detail-mono">
										{vehicle.activeTrip.customerId}
									</span>
								</div>
								<div className="detail-row">
									<span className="detail-label">Duration</span>
									<span className="detail-value">
										{Math.floor(
											(Date.now() - vehicle.activeTrip.startTime) /
												MS_PER_MINUTE,
										)}{" "}
										min
									</span>
								</div>
								<div className="trip-actions-stack">
									<button
										className="btn-small btn-chat"
										onClick={onOpenCustomerChat}
									>
										Chat With Customer
									</button>
									{canRecoverTrip && (
										<>
											<button
												className="btn-small btn-replace"
												onClick={onReplaceWithClosestCar}
												disabled={actionBusy}
											>
												{actionBusy
													? "Processing..."
													: "Replace Car (Closest Idle)"}
											</button>
										</>
									)}
								</div>
							</div>
						)}

						{vehicle.agentDispatched && (
							<div className="agent-dispatched">
								<h4>🚨 Agent Dispatched</h4>
								<div className="detail-row">
									<span className="detail-label">Issue</span>
									<span className="detail-value">
										{formatIssueType(vehicle.agentDispatched.issueType)}
									</span>
								</div>
								<div className="detail-row">
									<span className="detail-label">Agent</span>
									<span className="detail-value detail-mono">
										{vehicle.agentDispatched.agentId}
									</span>
								</div>
								<div className="detail-row">
									<span className="detail-label">Notes</span>
									<span className="detail-value">
										{vehicle.agentDispatched.notes}
									</span>
								</div>
							</div>
						)}

						{!vehicle.agentDispatched && canDispatchAgent && (
							<button className="btn-dispatch" onClick={onDispatchAgent}>
								Dispatch Field Agent Now
							</button>
						)}
					</>
				)}

				{activeTab === "LOGS" && (
					<div className="vehicle-logs-panel">
						<div className="vehicle-logs-controls">
							<select
								value={logFilter}
								onChange={(e) => setLogFilter(e.target.value as LogFilter)}
							>
								<option value="ALL">All Categories</option>
								<option value="SYSTEM">System</option>
								<option value="STATUS">Status</option>
								<option value="BATTERY">Battery</option>
								<option value="TRIP">Trip</option>
								<option value="DISPATCH">Dispatch</option>
								<option value="TELEMETRY">Telemetry</option>
							</select>
							<button
								className="btn-small"
								onClick={() => setLogRefreshToken((prev) => prev + 1)}
							>
								Refresh
							</button>
						</div>

						{loadingLogs && <div className="logs-empty">Loading logs...</div>}
						{!loadingLogs && logs.length === 0 && (
							<div className="logs-empty">
								No log events for this filter yet.
							</div>
						)}

						{!loadingLogs && logs.length > 0 && (
							<div className="vehicle-logs-list">
								{logs.map((log) => (
									<div className="vehicle-log-item" key={log.id}>
										<div className="vehicle-log-top">
											<strong>{log.category}</strong>
											<span>
												{new Date(log.timestamp).toLocaleTimeString()}
											</span>
										</div>
										<div className="vehicle-log-message">{log.message}</div>
										<div className="vehicle-log-meta">
											event: {log.eventType}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default VehicleDetails;
