import React, { useMemo, useState } from 'react';
import { API_BASE_URL, DEFAULT_BULK_ADD_COUNT, MAX_BULK_ADD_COUNT, MIN_BULK_ADD_COUNT } from './constants';

const LOCATIONS = [
  'Bellagio Hotel',
  'MGM Grand',
  'Caesars Palace',
  'The Venetian',
  'Luxor Hotel',
  'Mandalay Bay',
  'Wynn Las Vegas',
  'Aria Resort',
  'Paris Las Vegas',
  'New York New York',
  'Excalibur',
  'Mirage',
  'Treasure Island',
  'Circus Circus',
  'Stratosphere',
  'Downtown Las Vegas',
  'Las Vegas Convention Center',
  'T-Mobile Arena',
  'Allegiant Stadium',
  'UNLV'
];

type Scenario = {
  label: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
};

const SCENARIOS: Scenario[] = [
  {
    label: 'Airport Pickup',
    customerName: 'Sarah Miller',
    pickupAddress: 'Mandalay Bay',
    dropoffAddress: 'Downtown Las Vegas'
  },
  {
    label: 'Hotel Transfer',
    customerName: 'David Nguyen',
    pickupAddress: 'Bellagio Hotel',
    dropoffAddress: 'Wynn Las Vegas'
  },
  {
    label: 'Event Return',
    customerName: 'Elena Torres',
    pickupAddress: 'T-Mobile Arena',
    dropoffAddress: 'UNLV'
  },
];

const SimulateClientTrip: React.FC = () => {
  const [customerName, setCustomerName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [bulkCount, setBulkCount] = useState(DEFAULT_BULK_ADD_COUNT);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addingCars, setAddingCars] = useState(false);

  // Prevent invalid requests and double submits before hitting the backend.
  const canSubmit = useMemo(() => {
    return pickupAddress && dropoffAddress && pickupAddress !== dropoffAddress && !submitting;
  }, [pickupAddress, dropoffAddress, submitting]);

  const applyScenario = (scenario: Scenario) => {
    setCustomerName(scenario.customerName);
    setPickupAddress(scenario.pickupAddress);
    setDropoffAddress(scenario.dropoffAddress);
    setMessage('');
  };

  /**
   * Creates a customer trip and lets the backend auto-pick the nearest idle vehicle.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/trips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || undefined,
          pickupAddress,
          dropoffAddress,
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || 'Unable to create trip');
      }

      if (result.autoAssigned && result.vehicleId) {
        setMessage(`Trip created. Closest idle vehicle ${result.vehicleId} auto-assigned.`);
      } else {
        setMessage('Trip created. No idle vehicle available right now.');
      }

      setCustomerName('');
      setPickupAddress('');
      setDropoffAddress('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create trip');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Expands fleet size quickly for stress-testing map readability and dispatch workflows.
   */
  const handleBulkAddCars = async () => {
    if (addingCars) return;

    const count = Math.max(MIN_BULK_ADD_COUNT, Math.min(MAX_BULK_ADD_COUNT, Math.floor(bulkCount || MIN_BULK_ADD_COUNT)));
    setAddingCars(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles/bulk-random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || 'Unable to add random cars');
      }

      setMessage(`${result.added} random cars added to fleet.`);
      setBulkCount(DEFAULT_BULK_ADD_COUNT);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add random cars');
    } finally {
      setAddingCars(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '760px', background: '#fff', border: '1px solid #dbe2ee', borderRadius: '14px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)', padding: '24px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Simulate Client Trip Request</h1>
        <p style={{ color: '#475569', marginBottom: '18px', fontWeight: 600 }}>
          Create a customer request. System auto-assigns the closest idle vehicle.
        </p>

        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontWeight: 800, marginBottom: '10px' }}>Fleet Boost</p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '220px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 800 }}>Random Cars to Add</label>
              <input
                type="number"
                min={MIN_BULK_ADD_COUNT}
                max={MAX_BULK_ADD_COUNT}
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                style={{ width: '100%', minHeight: '56px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '12px 14px', fontSize: '20px', fontWeight: 700 }}
              />
            </div>
            <button
              type="button"
              onClick={handleBulkAddCars}
              disabled={addingCars}
              style={{
                minHeight: '60px',
                padding: '0 22px',
                borderRadius: '10px',
                border: 'none',
                background: addingCars ? '#94a3b8' : '#0f766e',
                color: '#fff',
                fontWeight: 900,
                fontSize: '19px',
                cursor: addingCars ? 'not-allowed' : 'pointer'
              }}
            >
              {addingCars ? 'Adding Cars...' : 'Add Random Cars In Bulk'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontWeight: 800, marginBottom: '10px' }}>Quick Scenarios</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {SCENARIOS.map(scenario => (
              <button
                key={scenario.label}
                type="button"
                onClick={() => applyScenario(scenario)}
                style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div style={{ marginBottom: '16px', borderRadius: '10px', padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', fontWeight: 700 }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 800 }}>Customer Name (optional)</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                style={{ width: '100%', minHeight: '52px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '12px 14px', fontSize: '17px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 800 }}>Pickup Location</label>
              <select
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                style={{ width: '100%', minHeight: '52px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '12px 14px', fontSize: '17px', fontWeight: 600 }}
              >
                <option value="">Select pickup location</option>
                {LOCATIONS.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 800 }}>Dropoff Location</label>
              <select
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                style={{ width: '100%', minHeight: '52px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '12px 14px', fontSize: '17px', fontWeight: 600 }}
              >
                <option value="">Select dropoff location</option>
                {LOCATIONS.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '18px', display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                minHeight: '60px',
                padding: '0 22px',
                borderRadius: '10px',
                border: 'none',
                background: canSubmit ? '#2563eb' : '#94a3b8',
                color: '#fff',
                fontWeight: 900,
                fontSize: '19px',
                cursor: canSubmit ? 'pointer' : 'not-allowed'
              }}
            >
              {submitting ? 'Creating...' : 'Create Request + Auto Assign Closest Idle Car'}
            </button>

            <button
              type="button"
              onClick={() => window.close()}
              style={{ minHeight: '60px', padding: '0 20px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, fontSize: '18px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulateClientTrip;
