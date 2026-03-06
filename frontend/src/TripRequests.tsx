import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, MS_PER_SECOND, REFRESH_INTERVAL_MS } from './constants';

interface TripRequest {
  tripId: string;
  customerId: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  requestTime: number;
  status: string;
}

const TripRequests: React.FC = () => {
  const [requests, setRequests] = useState<TripRequest[]>([]);

  useEffect(() => {
    const fetchRequests = () => {
      fetch(`${API_BASE_URL}/api/trip-requests`)
        .then(res => res.json())
        .then(data => setRequests(data))
        .catch(err => console.error('Failed to fetch trip requests:', err));
    };

    fetchRequests();
    const interval = setInterval(fetchRequests, REFRESH_INTERVAL_MS);

    const socket: Socket = io(API_BASE_URL);
    socket.on('trip-updated', fetchRequests);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const handleGenerateTrip = () => {
    window.open('/simulate-trip', '_blank', 'width=900,height=850');
  };

  const handleCancel = async (tripId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/trips/${tripId}/cancel`, {
        method: 'POST'
      });
      setRequests(prev => prev.filter(r => r.tripId !== tripId));
    } catch (error) {
      console.error('Failed to cancel trip:', error);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="trip-requests-panel">
        <div className="panel-header-row">
          <h3>Trip Requests (0)</h3>
          <button className="btn-operator primary" onClick={handleGenerateTrip}>
            + New Trip
          </button>
        </div>
        <p className="no-requests">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="trip-requests-panel">
      <div className="panel-header-row">
        <h3>Trip Requests ({requests.length})</h3>
        <button className="btn-operator primary" onClick={handleGenerateTrip}>
          + New Trip
        </button>
      </div>
      <div className="requests-list">
        {requests.map(request => {
          const elapsed = Math.floor((Date.now() - request.requestTime) / MS_PER_SECOND);
          return (
            <div key={request.tripId} className="request-item">
              <div className="request-header">
                <strong>{request.customerName}</strong>
                <span className="request-time">{elapsed}s ago</span>
              </div>
              <div className="request-route">
                <div className="route-point">📍 {request.pickupAddress}</div>
                <div className="route-arrow">→</div>
                <div className="route-point">🎯 {request.dropoffAddress}</div>
              </div>
              <div className="request-footer">
                <div className="request-actions">
                  <button 
                    className="btn-cancel-trip"
                    onClick={() => handleCancel(request.tripId)}
                  >
                    Cancel Trip
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TripRequests;
