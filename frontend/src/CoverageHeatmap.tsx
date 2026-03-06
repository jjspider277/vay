import React, { useEffect, useState } from 'react';
import { Circle } from 'react-leaflet';
import { API_BASE_URL, REFRESH_INTERVAL_MS } from './constants';

interface CoverageData {
  lat: number;
  lng: number;
  count: number;
  coverage: 'low' | 'medium' | 'high';
}

interface CoverageHeatmapProps {
  show: boolean;
}

const CoverageHeatmap: React.FC<CoverageHeatmapProps> = ({ show }) => {
  const [coverage, setCoverage] = useState<CoverageData[]>([]);

  useEffect(() => {
    if (!show) {
      return;
    }

    const fetchCoverage = () => {
      fetch(`${API_BASE_URL}/api/coverage-analysis`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCoverage(data);
          }
        })
        .catch(err => console.error('Failed to fetch coverage:', err));
    };

    fetchCoverage();
    const interval = setInterval(fetchCoverage, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [show]);

  if (!show || coverage.length === 0) return null;

  const getColor = (level: string) => {
    switch (level) {
      case 'low': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'high': return '#22c55e';
      default: return '#gray';
    }
  };

  return (
    <>
      {coverage.map((cell, idx) => (
        <Circle
          key={idx}
          center={[cell.lat, cell.lng]}
          radius={1000}
          pathOptions={{
            fillColor: getColor(cell.coverage),
            fillOpacity: 0.3,
            color: getColor(cell.coverage),
            weight: 1,
            opacity: 0.5
          }}
        />
      ))}
    </>
  );
};

export default CoverageHeatmap;
