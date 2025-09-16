import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Report {
  id: number;
  description: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'verified' | 'resolved';
  timestamp: string;
  created_at: string;
}

const API_BASE_URL = 'http://localhost:5000';

// Create custom markers for different statuses
const createCustomIcon = (status: string) => {
  let color = '#ff6b6b'; // red for pending
  
  switch (status) {
    case 'verified':
      color = '#4ecdc4'; // teal for verified
      break;
    case 'resolved':
      color = '#45b7d1'; // blue for resolved
      break;
    default:
      color = '#ff6b6b'; // red for pending
  }
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color}; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5]
  });
};

const MapView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports`);
      setReports(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff6b6b';
      case 'verified':
        return '#4ecdc4';
      case 'resolved':
        return '#45b7d1';
      default:
        return '#ff6b6b';
    }
  };

  // Default center (you can change this to your city's coordinates)
  const defaultCenter: [number, number] = [28.6139, 77.2090]; // New Delhi coordinates

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="error-message">{error}</div>
        <button onClick={fetchReports} className="btn btn-small" style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Civic Issue Reports</h1>
        <button onClick={fetchReports} className="btn btn-small">
          Refresh Map
        </button>
      </div>
      
      {/* Legend */}
      <div style={{ 
        marginBottom: '1rem', 
        padding: '1rem', 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <strong>Legend:</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('pending'),
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}></div>
          <span>Pending</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('verified'),
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}></div>
          <span>Verified</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('resolved'),
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}></div>
          <span>Resolved</span>
        </div>
        <div style={{ marginLeft: 'auto', color: '#666' }}>
          Total Reports: {reports.length}
        </div>
      </div>

      <div className="map-container">
        <MapContainer
          center={defaultCenter}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {reports.map((report) => (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={createCustomIcon(report.status)}
            >
              <Popup maxWidth={300}>
                <div style={{ maxWidth: '280px' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <img
                      src={`${API_BASE_URL}${report.photo_url}`}
                      alt="Issue"
                      style={{ 
                        width: '100%', 
                        height: '150px', 
                        objectFit: 'cover', 
                        borderRadius: '4px' 
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Status:</strong>{' '}
                    <span 
                      className={`status-badge status-${report.status}`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {report.status}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Description:</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                      {report.description.length > 100 
                        ? `${report.description.substring(0, 100)}...` 
                        : report.description}
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                    <strong>Location:</strong> {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    <strong>Reported:</strong> {formatDate(report.created_at)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      {reports.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          marginTop: '1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p>No reports found. Be the first to report a civic issue!</p>
        </div>
      )}
    </div>
  );
};

export default MapView;