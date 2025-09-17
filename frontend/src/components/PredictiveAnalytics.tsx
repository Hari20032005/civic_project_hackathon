import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

interface WeeklyTrend {
  period: string;
  category: string;
  count: number;
}

interface SeasonalTrend {
  [month: number]: {
    [category: string]: number;
  };
}

interface Hotspot {
  center: {
    lat: number;
    lng: number;
  };
  reports: any[];
  count: number;
  categories: { [key: string]: number };
  severity: { HIGH: number; MEDIUM: number; LOW: number };
  topCategory: string;
  topSeverity: string;
  growthRate: number;
}

interface Prediction {
  historical: any[];
  predicted: { periodIndex: number; predictedCount: number }[];
  trend: string;
}

interface PredictiveAnalyticsData {
  weeklyTrends: WeeklyTrend[];
  seasonalTrends: SeasonalTrend;
  emergingHotspots: Hotspot[];
  predictions: { [category: string]: Prediction };
  generatedAt: string;
}

const PredictiveAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<PredictiveAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/predictive`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setAnalytics(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching predictive analytics:', err);
      
      // Handle unauthorized access
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin';
        return;
      }
      
      setError('Failed to load predictive analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `Month ${month}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'POTHOLE': '#f44336',
      'STREET_LIGHT': '#ff9800',
      'GARBAGE_OVERFLOW': '#4caf50',
      'DRAIN_BLOCKAGE': '#2196f3',
      'BROKEN_SIDEWALK': '#9c27b0',
      'WATER_LEAK': '#00bcd4',
      'DAMAGED_SIGN': '#ff5722',
      'ILLEGAL_DUMPING': '#795548',
      'VEGETATION_OVERGROWTH': '#4caf50',
      'OTHER': '#9e9e9e'
    };
    return colors[category] || '#3f51b5';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading predictive analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="error-message">{error}</div>
        <button onClick={fetchAnalytics} className="btn btn-small" style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No analytics data available.</p>
      </div>
    );
  }

  // Get unique categories
  const categories = Array.from(
    new Set(analytics.weeklyTrends.map(item => item.category))
  );

  // Filter data based on selected category
  const filteredWeeklyTrends = selectedCategory === 'all' 
    ? analytics.weeklyTrends 
    : analytics.weeklyTrends.filter(item => item.category === selectedCategory);

  // Prepare data for charts
  const prepareWeeklyData = () => {
    // Group by period and category
    const grouped: { [period: string]: { [category: string]: number } } = {};
    
    filteredWeeklyTrends.forEach(item => {
      if (!grouped[item.period]) {
        grouped[item.period] = {};
      }
      if (!grouped[item.period][item.category]) {
        grouped[item.period][item.category] = 0;
      }
      grouped[item.period][item.category] += item.count;
    });

    // Convert to array format
    return Object.entries(grouped).map(([period, categories]) => ({
      period,
      ...categories
    }));
  };

  const weeklyChartData = prepareWeeklyData();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Predictive Analytics Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={fetchAnalytics} className="btn btn-small">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Summary Cards */}
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
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b' }}>Emerging Hotspots</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {analytics.emergingHotspots.length}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#4ecdc4' }}>Categories Tracked</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {categories.length}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#45b7d1' }}>Predictive Models</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {Object.keys(analytics.predictions).length}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>Last Updated</h3>
          <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
            {new Date(analytics.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '2rem', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Category:
          </label>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Emerging Hotspots */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: '1rem' }}>📍 Emerging Hotspots</h2>
        {analytics.emergingHotspots.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {analytics.emergingHotspots.map((hotspot, index) => (
              <div 
                key={index} 
                style={{ 
                  border: '1px solid #eee', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ margin: 0, color: '#d32f2f' }}>
                    Hotspot #{index + 1}
                  </h3>
                  <span style={{ 
                    backgroundColor: '#d32f2f', 
                    color: 'white', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {hotspot.count} reports
                  </span>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Location:</strong> {hotspot.center.lat.toFixed(4)}, {hotspot.center.lng.toFixed(4)}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Primary Issue:</strong> {hotspot.topCategory.replace('_', ' ')}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Severity:</strong> {hotspot.topSeverity}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Growth Rate:</strong> {hotspot.growthRate.toFixed(1)}%
                  </p>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  {Object.entries(hotspot.categories).map(([category, count]) => (
                    <span 
                      key={category}
                      style={{ 
                        backgroundColor: getCategoryColor(category),
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    >
                      {category.replace('_', ' ')}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            No emerging hotspots detected in the last 2 weeks.
          </p>
        )}
      </div>

      {/* Weekly Trends */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: '1rem' }}>📈 Weekly Trends</h2>
        {weeklyChartData.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Week</th>
                  {categories.map(category => (
                    <th key={category} style={{ color: getCategoryColor(category) }}>
                      {category.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyChartData.map((weekData, index) => (
                  <tr key={index}>
                    <td>{weekData.period}</td>
                    {categories.map(category => (
                      <td key={category}>
                        {(weekData as any)[category] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            No trend data available.
          </p>
        )}
      </div>

      {/* Seasonal Trends */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: '1rem' }}>🌦️ Seasonal Trends</h2>
        {Object.keys(analytics.seasonalTrends).length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  {categories.map(category => (
                    <th key={category} style={{ color: getCategoryColor(category) }}>
                      {category.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.seasonalTrends).map(([month, data]) => (
                  <tr key={month}>
                    <td>{getMonthName(parseInt(month))}</td>
                    {categories.map(category => (
                      <td key={category}>
                        {(data as any)[category] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            No seasonal data available.
          </p>
        )}
      </div>

      {/* Predictions */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1976d2', marginBottom: '1rem' }}>🔮 Predictions</h2>
        {Object.keys(analytics.predictions).length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {Object.entries(analytics.predictions).map(([category, prediction]) => (
              <div 
                key={category} 
                style={{ 
                  border: '1px solid #eee', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ margin: 0, color: getCategoryColor(category) }}>
                    {category.replace('_', ' ')}
                  </h3>
                  <span style={{ 
                    backgroundColor: prediction.trend === 'increasing' ? '#f44336' : 
                                   prediction.trend === 'decreasing' ? '#4caf50' : '#ff9800',
                    color: 'white', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {prediction.trend.charAt(0).toUpperCase() + prediction.trend.slice(1)}
                  </span>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Historical Data:</h4>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {prediction.historical.slice(0, 5).map((item, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          backgroundColor: '#e3f2fd', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div>Week {item.period}</div>
                        <div style={{ fontWeight: 'bold', textAlign: 'center' }}>
                          {item.count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Predicted:</h4>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {prediction.predicted.slice(0, 4).map((item, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          backgroundColor: '#fff3e0', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div>Week +{idx + 1}</div>
                        <div style={{ fontWeight: 'bold', textAlign: 'center' }}>
                          {item.predictedCount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            No predictions available.
          </p>
        )}
      </div>
    </div>
  );
};

export default PredictiveAnalytics;