import { useState, useCallback } from 'react';
import { API_BASE_URL, MESSAGE_CLEAR_DELAY_MS } from './constants';

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
] as const;

const CreateTrip = () => {
  const [customerName, setCustomerName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/trips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || undefined,
          pickupAddress: pickupAddress || undefined,
          dropoffAddress: dropoffAddress || undefined,
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.autoAssigned && result.vehicleId) {
          setMessage(`✅ Trip created and auto-assigned to ${result.vehicleId}`);
        } else {
          setMessage('✅ Trip created. No idle vehicle available yet.');
        }
        setCustomerName('');
        setPickupAddress('');
        setDropoffAddress('');
        setTimeout(() => setMessage(''), MESSAGE_CLEAR_DELAY_MS);
      }
    } catch (error) {
      setMessage('❌ Failed to create trip');
    }
  }, [customerName, pickupAddress, dropoffAddress]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8f9fa', 
      padding: '40px 20px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{ marginBottom: '30px', fontSize: '28px', color: '#212529' }}>
          Create New Trip
        </h1>

        {message && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            borderRadius: '6px',
            background: message.includes('✅') ? '#d1fae5' : '#fee2e2',
            color: message.includes('✅') ? '#065f46' : '#991b1b',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Pickup Location
            </label>
            <select
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select pickup location</option>
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Dropoff Location
            </label>
            <select
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select dropoff location</option>
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '19px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
          >
            Create Trip + Auto Assign
          </button>

          <button
            type="button"
            onClick={() => window.close()}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '16px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '19px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '12px'
            }}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTrip;
