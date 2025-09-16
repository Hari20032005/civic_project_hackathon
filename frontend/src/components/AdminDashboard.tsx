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

const AdminDashboard: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

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

  const updateReportStatus = async (reportId: number, newStatus: 'pending' | 'verified' | 'resolved') => {
    setUpdatingStatus(reportId);
    
    try {
      await axios.patch(`${API_BASE_URL}/report/${reportId}`, { status: newStatus });
      
      // Update local state
      setReports(prevReports => 
        prevReports.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        )
      );
      
      // Update selected report if it's the one being updated
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update report status. Please try again.');
    } finally {
      setUpdatingStatus(null);
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

  const getStatusCounts = () => {
    return {
      pending: reports.filter(r => r.status === 'pending').length,
      verified: reports.filter(r => r.status === 'verified').length,
      resolved: reports.filter(r => r.status === 'resolved').length
    };
  };

  const openReportMap = (report: Report) => {
    setSelectedReport(report);
    setShowMap(true);
  };

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

  const statusCounts = getStatusCounts();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin Dashboard</h1>
        <button onClick={fetchReports} className="btn btn-small">
          Refresh Data
        </button>
      </div>

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b' }}>Pending</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{statusCounts.pending}</p>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#4ecdc4' }}>Verified</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{statusCounts.verified}</p>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#45b7d1' }}>Resolved</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{statusCounts.resolved}</p>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>Total</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{reports.length}</p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Photo</th>
              <th>Description</th>
              <th>Location</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.id}</td>
                
                <td>
                  <img
                    src={`${API_BASE_URL}${report.photo_url}`}
                    alt="Issue"
                    className="thumbnail"
                    onClick={() => window.open(`${API_BASE_URL}${report.photo_url}`, '_blank')}
                  />
                </td>
                
                <td>
                  <div style={{ maxWidth: '200px' }}>
                    {report.description.length > 80 
                      ? `${report.description.substring(0, 80)}...` 
                      : report.description}
                  </div>
                </td>
                
                <td>
                  <div style={{ fontSize: '0.875rem' }}>
                    <div>{report.latitude.toFixed(4)},</div>
                    <div>{report.longitude.toFixed(4)}</div>
                    <button
                      onClick={() => openReportMap(report)}
                      className="btn btn-small"
                      style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}
                    >
                      🗺️ View Map
                    </button>
                  </div>
                </td>
                
                <td>
                  <span className={`status-badge status-${report.status}`}>
                    {report.status}
                  </span>
                </td>
                
                <td style={{ fontSize: '0.875rem' }}>
                  {formatDate(report.created_at)}
                </td>
                
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                    {report.status === 'pending' && (
                      <button
                        onClick={() => updateReportStatus(report.id, 'verified')}
                        className="btn btn-small btn-success"
                        disabled={updatingStatus === report.id}
                      >
                        {updatingStatus === report.id ? 'Updating...' : '✓ Verify'}
                      </button>
                    )}
                    
                    {report.status === 'verified' && (
                      <button
                        onClick={() => updateReportStatus(report.id, 'resolved')}
                        className="btn btn-small btn-success"
                        disabled={updatingStatus === report.id}
                      >
                        {updatingStatus === report.id ? 'Updating...' : '✓ Resolve'}
                      </button>
                    )}
                    
                    {report.status !== 'pending' && (
                      <button
                        onClick={() => updateReportStatus(report.id, 'pending')}
                        className="btn btn-small btn-danger"
                        disabled={updatingStatus === report.id}
                      >
                        {updatingStatus === report.id ? 'Updating...' : '↺ Reset'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {reports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>No reports found.</p>
          </div>
        )}
      </div>

      {/* Map Modal */}
      {showMap && selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1rem',
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: '800px',
            height: '600px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1rem' 
            }}>
              <h3>Report #{selectedReport.id} Location</h3>
              <button
                onClick={() => setShowMap(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ flex: 1, borderRadius: '4px', overflow: 'hidden' }}>
              <MapContainer
                center={[selectedReport.latitude, selectedReport.longitude]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[selectedReport.latitude, selectedReport.longitude]}>
                  <Popup>
                    <div>
                      <strong>Report #{selectedReport.id}</strong>
                      <p>{selectedReport.description}</p>
                      <p><strong>Status:</strong> <span className={`status-badge status-${selectedReport.status}`}>{selectedReport.status}</span></p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;