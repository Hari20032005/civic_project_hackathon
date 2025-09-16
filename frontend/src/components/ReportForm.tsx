import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

const API_BASE_URL = 'http://localhost:5000';

const ReportForm: React.FC = () => {
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default location (you can change this to your city's coordinates)

  // Default location (you can change this to your city's coordinates)
  const DEFAULT_LOCATION = { latitude: 28.6139, longitude: 77.2090 }; // New Delhi coordinates

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          setIsGettingLocation(false);
          
          // Optional: Reverse geocoding to get address
          reverseGeocode(latitude, longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Unable to get your location. ';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please allow location access when prompted by your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable. Try refreshing the page or entering coordinates manually.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out. Please try again or enter coordinates manually.';
              break;
            default:
              errorMessage += 'Please ensure location services are enabled and try again, or enter coordinates manually.';
              break;
          }
          
          setErrorMessage(errorMessage);
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: false, // Set to false for better compatibility
          timeout: 15000, // Increase timeout
          maximumAge: 300000 // Accept cached location up to 5 minutes old
        }
      );
    } else {
      setErrorMessage('Geolocation is not supported by this browser. Please enter coordinates manually.');
      setIsGettingLocation(false);
    }
  };

  const handleManualLocation = () => {
    const lat = parseFloat(manualLatitude);
    const lng = parseFloat(manualLongitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErrorMessage('Please enter valid latitude (-90 to 90) and longitude (-180 to 180) values.');
      return;
    }
    
    setLocation({ latitude: lat, longitude: lng });
    setShowManualLocation(false);
    setErrorMessage('');
    
    // Try to get address for the manual coordinates
    reverseGeocode(lat, lng);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      // Using OpenStreetMap's Nominatim service for reverse geocoding with proper headers
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CivicReporter/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.display_name) {
          setLocation(prev => prev ? { ...prev, address: data.display_name } : null);
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Don't show error to user as this is optional
      // We'll just show coordinates without the readable address
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrorMessage('Image size must be less than 5MB');
        return;
      }
      
      setPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Clear any previous error
      setErrorMessage('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!photo) {
      setErrorMessage('Please select or capture a photo.');
      return;
    }
    
    // Description is now optional - no validation needed
    
    if (!location) {
      setErrorMessage('Location information is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('description', description);
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());

      const response = await axios.post(`${API_BASE_URL}/report`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 201) {
        const result = response.data;
        
        if (result.isDuplicate) {
          setSuccessMessage(`Report submitted successfully! Our AI detected this might be similar to an existing report #${result.primaryReportId}. Both reports will be reviewed by administrators.`);
        } else {
          setSuccessMessage('Report submitted successfully! Thank you for helping improve our community.');
        }
        
        // Show AI analysis if available
        if (result.aiAnalysis) {
          setAiAnalysis({
            ...result.aiAnalysis,
            isDuplicate: result.isDuplicate,
            duplicateInfo: result.duplicateInfo,
            nearbyReportsChecked: result.nearbyReportsChecked
          });
          setShowAiAnalysis(true);
        }
        
        // Don't reset the form while showing AI analysis
        // The form will be reset when the user clicks "Submit New Report"
        
        // Scroll to success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Submission error:', error);
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.error || 'Failed to submit report. Please try again.');
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container">
      <h1 className="form-title">Report Civic Issue</h1>
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      
      {showAiAnalysis && aiAnalysis && (
        <div style={{
          backgroundColor: '#e3f2fd',
          border: '1px solid #2196f3',
          borderRadius: '8px',
          padding: '1rem',
          margin: '1rem 0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1976d2' }}>🤖 AI Analysis Results</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <strong>Category:</strong>
              <div style={{ 
                display: 'inline-block', 
                backgroundColor: '#4caf50', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.875rem',
                marginLeft: '0.5rem'
              }}>
                {aiAnalysis.category?.replace('_', ' ')}
              </div>
            </div>
            
            <div>
              <strong>Severity:</strong>
              <div style={{ 
                display: 'inline-block', 
                backgroundColor: aiAnalysis.severity === 'HIGH' ? '#f44336' : aiAnalysis.severity === 'MEDIUM' ? '#ff9800' : '#4caf50', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px', 
                fontSize: '0.875rem',
                marginLeft: '0.5rem'
              }}>
                {aiAnalysis.severity}
              </div>
            </div>
            
            <div>
              <strong>Confidence:</strong>
              <div style={{ marginLeft: '0.5rem', color: '#1976d2', fontWeight: 'bold' }}>
                {aiAnalysis.confidence}%
              </div>
            </div>
            
            <div>
              <strong>Department:</strong>
              <div style={{ marginLeft: '0.5rem' }}>
                {aiAnalysis.department}
              </div>
            </div>
          </div>
          
          {aiAnalysis.urgent && (
            <div style={{ 
              backgroundColor: '#ffebee', 
              color: '#c62828', 
              padding: '0.5rem', 
              borderRadius: '4px', 
              marginBottom: '1rem',
              border: '1px solid #ef5350'
            }}>
              ⚠️ <strong>URGENT:</strong> This issue requires immediate attention!
            </div>
          )}
          
          <div style={{ marginBottom: '1rem' }}>
            <strong>Technical Assessment:</strong>
            <p style={{ margin: '0.5rem 0', color: '#555' }}>
              {aiAnalysis.technicalAssessment}
            </p>
          </div>
          
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', fontSize: '0.875rem', color: '#666' }}>
            <div><strong>Est. Time:</strong> {aiAnalysis.estimatedTime}</div>
            <div><strong>Est. Cost:</strong> {aiAnalysis.estimatedCost || 'Variable'}</div>
            {aiAnalysis.nearbyReportsChecked !== undefined && (
              <div><strong>Nearby Reports Checked:</strong> {aiAnalysis.nearbyReportsChecked}</div>
            )}
          </div>
          
          {aiAnalysis.isDuplicate && aiAnalysis.duplicateInfo && (
            <div style={{
              backgroundColor: '#fff3e0',
              border: '2px solid #ff9800',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#e65100' }}>🔄 Potential Duplicate Detected</h4>
              <p style={{ margin: '0 0 1rem 0', color: '#e65100' }}>
                {aiAnalysis.duplicateInfo.message}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div><strong>Similarity:</strong> {aiAnalysis.duplicateInfo.similarityScore}%</div>
                <div><strong>Distance:</strong> {aiAnalysis.duplicateInfo.distance.toFixed(1)}m</div>
                <div><strong>Primary Report:</strong> #{aiAnalysis.duplicateInfo.primaryReportId}</div>
              </div>
              {aiAnalysis.duplicateInfo.reasoning && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', fontStyle: 'italic', color: '#bf360c' }}>
                  <strong>AI Reasoning:</strong> {aiAnalysis.duplicateInfo.reasoning}
                </div>
              )}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button
              onClick={() => {
                // Reset form for a new report
                setDescription('');
                setPhoto(null);
                setPhotoPreview(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                setShowAiAnalysis(false);
                setSuccessMessage('');
              }}
              style={{
                backgroundColor: '#4caf50',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                border: 'none'
              }}
            >
              Submit New Report
            </button>
            <button
              onClick={() => setShowAiAnalysis(false)}
              style={{
                background: 'none',
                border: '1px solid #2196f3',
                color: '#2196f3',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Close Analysis
            </button>
          </div>
        </div>
      )}
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Photo Upload */}
        <div className="form-group">
          <label className="form-label">Photo of Issue *</label>
          <div className="file-input" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              capture="environment"
            />
            {photoPreview ? (
              <div>
                <img src={photoPreview} alt="Preview" className="preview-image" />
                <p>Click to change photo</p>
              </div>
            ) : (
              <div>
                <p>📷 Click to take photo or select image</p>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>Max size: 5MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description" className="form-label">Description (Optional)</label>
          <textarea
            id="description"
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any additional details about the civic issue (optional)..."
          />
        </div>

        {/* Location Info */}
        <div className="form-group">
          <label className="form-label">Location</label>
          {isGettingLocation && (
            <div className="location-info">
              📍 Getting your location...
            </div>
          )}
          {location && (
            <div className="location-info">
              📍 Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              {location.address && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                  {location.address}
                </div>
              )}
            </div>
          )}
                    {!location && !isGettingLocation && (
            <div>
              <div style={{ 
                backgroundColor: '#fff3e0', 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '1px solid #ff9800',
                marginBottom: '1rem'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#e65100' }}>
                  <strong>📍 Location Required</strong>
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#e65100' }}>
                  We need your location to map the civic issue. You can either allow location access, enter coordinates manually, or use default location.
                </p>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="btn btn-small"
                  style={{ 
                    backgroundColor: '#2196f3',
                    color: 'white'
                  }}
                >
                  📍 Get Current Location
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocation(DEFAULT_LOCATION);
                    // Try to get address for the default coordinates
                    reverseGeocode(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
                  }}
                  className="btn btn-small"
                  style={{ 
                    backgroundColor: '#4caf50',
                    color: 'white'
                  }}
                >
                  🏙️ Use Default Location
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocation(DEFAULT_LOCATION);
                    // Try to get address for the default coordinates
                    reverseGeocode(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
                  }}
                  className="btn btn-small"
                  style={{ 
                    backgroundColor: '#4caf50',
                    color: 'white'
                  }}
                >
                  🏙️ Use Default Location
                </button>
              </div>
            </div>
          )}
          
          {showManualLocation && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              border: '1px solid #ddd', 
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>Enter Location Coordinates</h4>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                You can find coordinates using Google Maps:
                <br />
                1. Right-click on the location
                <br />
                2. Select "What's here?"
                <br />
                3. Copy the coordinates (e.g., 28.6139, 77.2090)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 28.6139"
                    value={manualLatitude}
                    onChange={(e) => setManualLatitude(e.target.value)}
                    step="any"
                    min="-90"
                    max="90"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 77.2090"
                    value={manualLongitude}
                    onChange={(e) => setManualLongitude(e.target.value)}
                    step="any"
                    min="-180"
                    max="180"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleManualLocation}
                  className="btn btn-small"
                  style={{
                    backgroundColor: '#4caf50',
                    color: 'white',
                    flex: 1
                  }}
                >
                  Use These Coordinates
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualLocation(false)}
                  className="btn btn-small"
                  style={{
                    backgroundColor: '#f44336',
                    color: 'white'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn"
          disabled={isSubmitting || !photo || !location || showAiAnalysis}
          style={{
            opacity: showAiAnalysis ? 0.5 : 1,
            cursor: showAiAnalysis ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                border: '2px solid #ffffff40', 
                borderTop: '2px solid white', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}></div>
              Analyzing with AI...
            </div>
          ) : showAiAnalysis ? 'Report Submitted' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
};

export default ReportForm;
