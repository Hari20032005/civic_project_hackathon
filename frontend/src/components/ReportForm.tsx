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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          console.error('Error getting location:', error);
          setErrorMessage('Unable to get your location. Please ensure location services are enabled.');
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setErrorMessage('Geolocation is not supported by this browser.');
      setIsGettingLocation(false);
    }
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
    
    if (!description.trim()) {
      setErrorMessage('Please provide a description of the issue.');
      return;
    }
    
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
        setSuccessMessage('Report submitted successfully! Thank you for helping improve our community.');
        
        // Show AI analysis if available
        if (result.aiAnalysis) {
          setAiAnalysis(result.aiAnalysis);
          setShowAiAnalysis(true);
        }
        
        // Reset form
        setDescription('');
        setPhoto(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
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
          </div>
          
          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
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
          <label htmlFor="description" className="form-label">Description *</label>
          <textarea
            id="description"
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the civic issue in detail..."
            required
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
            <button
              type="button"
              onClick={getCurrentLocation}
              className="btn btn-small"
              style={{ marginTop: '0.5rem' }}
            >
              📍 Get Current Location
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn"
          disabled={isSubmitting || !photo || !description.trim() || !location}
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
          ) : 'Submit Report'}
        </button>
      </form>
    </div>
  );
};

export default ReportForm;
