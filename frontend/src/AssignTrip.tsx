import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from './constants';

interface TripRequest {
  tripId: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
}

interface Vehicle {
  id: string;
  location: { lat: number; lng: number };
  battery: number;
  status: string;
}

const AssignTrip: React.FC = () => {
  const [trip, setTrip] = useState<TripRequest | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');

    if (tripId) {
      fetch(`${API_BASE_URL}/api/all-trips`)
        .then(res => res.json())
        .then(trips => {
          const foundTrip = trips.find((t: any) => t.tripId === tripId);
          if (foundTrip) setTrip(foundTrip);
        });

      fetch(`${API_BASE_URL}/api/vehicles`)
        .then(res => res.json())
        .then(data => {
          const freeVehicles = data.filter((v: Vehicle) => v.status === 'FREE');
          setVehicles(freeVehicles);
        });
    }
  }, []);

  const handleAssign = async () => {
    if (!selectedVehicle || !trip) return;

    try {
      await fetch(`${API_BASE_URL}/api/trips/${trip.tripId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: selectedVehicle })
      });
      alert('Trip assigned successfully!');
      window.close();
    } catch (error) {
      alert('Failed to assign trip');
    }
  };

  if (!trip) return <div style={{ padding: 20 }}>Loading...</div>;

  const vehicleIcon = L.divIcon({
    html: '<div style="background:#22c55e;width:20px;height:20px;border-radius:50%;border:2px solid white;"></div>',
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '350px', padding: '20px', background: '#f8f9fa', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '20px' }}>Assign Trip</h2>
        
        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Trip Details</h3>
          <p><strong>Customer:</strong> {trip.customerName}</p>
          <p><strong>From:</strong> {trip.pickupAddress}</p>
          <p><strong>To:</strong> {trip.dropoffAddress}</p>
        </div>

        <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Available Vehicles ({vehicles.length})</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {vehicles.map(vehicle => (
            <div
              key={vehicle.id}
              onClick={() => setSelectedVehicle(vehicle.id)}
              style={{
                padding: '15px',
                background: selectedVehicle === vehicle.id ? '#dbeafe' : 'white',
                border: selectedVehicle === vehicle.id ? '2px solid #3b82f6' : '1px solid #dee2e6',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{vehicle.id}</div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                Battery: {Math.round(vehicle.battery)}%
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAssign}
          disabled={!selectedVehicle}
          style={{
            width: '100%',
            minHeight: '58px',
            padding: '16px',
            marginTop: '20px',
            background: selectedVehicle ? '#22c55e' : '#dee2e6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '19px',
            fontWeight: 'bold',
            cursor: selectedVehicle ? 'pointer' : 'not-allowed'
          }}
        >
          Assign Vehicle
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <MapContainer
          center={[trip.pickupLocation.lat, trip.pickupLocation.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          
          <Marker position={[trip.pickupLocation.lat, trip.pickupLocation.lng]} />
          <Marker position={[trip.dropoffLocation.lat, trip.dropoffLocation.lng]} />
          
          <Polyline
            positions={[
              [trip.pickupLocation.lat, trip.pickupLocation.lng],
              [trip.dropoffLocation.lat, trip.dropoffLocation.lng]
            ]}
            color="#3b82f6"
            weight={3}
            dashArray="10, 10"
          />

          {vehicles.map(vehicle => (
            <Marker
              key={vehicle.id}
              position={[vehicle.location.lat, vehicle.location.lng]}
              icon={vehicleIcon}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default AssignTrip;
