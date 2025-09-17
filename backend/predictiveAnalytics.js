const db = require('./database');

class PredictiveAnalyticsService {
  constructor() {
    // Simple linear regression implementation
    this.linearRegression = (x, y) => {
      const n = x.length;
      let sum_x = 0;
      let sum_y = 0;
      let sum_xy = 0;
      let sum_xx = 0;
      
      for (let i = 0; i < n; i++) {
        sum_x += x[i];
        sum_y += y[i];
        sum_xy += x[i] * y[i];
        sum_xx += x[i] * x[i];
      }
      
      const slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
      const intercept = (sum_y - slope * sum_x) / n;
      
      return { slope, intercept };
    };
    
    // Simple clustering algorithm for hotspot detection
    this.clusterLocations = (reports, radius = 100) => {
      const clusters = [];
      const visited = new Set();
      
      reports.forEach((report, index) => {
        if (visited.has(index)) return;
        
        const cluster = {
          center: { 
            lat: report.latitude, 
            lng: report.longitude 
          },
          reports: [report],
          count: 1,
          categories: {},
          severity: { HIGH: 0, MEDIUM: 0, LOW: 0 }
        };
        
        // Initialize category and severity counts
        if (report.category) {
          cluster.categories[report.category] = (cluster.categories[report.category] || 0) + 1;
        }
        if (report.severity) {
          cluster.severity[report.severity]++;
        }
        
        // Find nearby reports
        for (let j = index + 1; j < reports.length; j++) {
          if (visited.has(j)) continue;
          
          const distance = this.calculateDistance(
            report.latitude, report.longitude,
            reports[j].latitude, reports[j].longitude
          );
          
          if (distance <= radius) {
            visited.add(j);
            cluster.reports.push(reports[j]);
            cluster.count++;
            
            // Update category and severity counts
            if (reports[j].category) {
              cluster.categories[reports[j].category] = (cluster.categories[reports[j].category] || 0) + 1;
            }
            if (reports[j].severity) {
              cluster.severity[reports[j].severity]++;
            }
          }
        }
        
        // Calculate cluster center
        if (cluster.reports.length > 1) {
          const avgLat = cluster.reports.reduce((sum, r) => sum + r.latitude, 0) / cluster.reports.length;
          const avgLng = cluster.reports.reduce((sum, r) => sum + r.longitude, 0) / cluster.reports.length;
          cluster.center = { lat: avgLat, lng: avgLng };
        }
        
        clusters.push(cluster);
        visited.add(index);
      });
      
      return clusters;
    };
    
    // Calculate distance between two coordinates using Haversine formula
    this.calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      const distance = R * c; // in metres
      return distance;
    };
  }
  
  // Get reports grouped by time periods
  async getReportsByTimePeriod(timeUnit = 'week') {
    return new Promise((resolve, reject) => {
      let query;
      
      switch (timeUnit) {
        case 'day':
          query = `
            SELECT 
              DATE(created_at) as period,
              category,
              COUNT(*) as count
            FROM reports 
            WHERE created_at >= date('now', '-30 days')
            GROUP BY DATE(created_at), category
            ORDER BY period DESC
          `;
          break;
        case 'week':
          query = `
            SELECT 
              strftime('%Y-%W', created_at) as period,
              category,
              COUNT(*) as count
            FROM reports 
            WHERE created_at >= date('now', '-12 weeks')
            GROUP BY strftime('%Y-%W', created_at), category
            ORDER BY period DESC
          `;
          break;
        case 'month':
          query = `
            SELECT 
              strftime('%Y-%m', created_at) as period,
              category,
              COUNT(*) as count
            FROM reports 
            WHERE created_at >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', created_at), category
            ORDER BY period DESC
          `;
          break;
        default:
          query = `
            SELECT 
              strftime('%Y-%W', created_at) as period,
              category,
              COUNT(*) as count
            FROM reports 
            WHERE created_at >= date('now', '-12 weeks')
            GROUP BY strftime('%Y-%W', created_at), category
            ORDER BY period DESC
          `;
      }
      
      db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  // Get seasonal trends
  async getSeasonalTrends() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%m', created_at) as month,
          category,
          COUNT(*) as count
        FROM reports 
        GROUP BY strftime('%m', created_at), category
        ORDER BY month
      `;
      
      db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Group by month and category
          const trends = {};
          rows.forEach(row => {
            const month = parseInt(row.month);
            if (!trends[month]) {
              trends[month] = {};
            }
            trends[month][row.category] = row.count;
          });
          
          resolve(trends);
        }
      });
    });
  }
  
  // Predict future trends using linear regression
  predictTrends(historicalData, periodsAhead = 4) {
    // Group data by category
    const categories = {};
    historicalData.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    
    // For each category, predict future values
    const predictions = {};
    
    Object.keys(categories).forEach(category => {
      const data = categories[category];
      if (data.length < 2) return; // Need at least 2 points for regression
      
      // Convert period to numeric values for regression
      const x = data.map((item, index) => index);
      const y = data.map(item => item.count);
      
      // Calculate linear regression
      const { slope, intercept } = this.linearRegression(x, y);
      
      // Predict next periods
      const future = [];
      for (let i = 1; i <= periodsAhead; i++) {
        const nextIndex = x[x.length - 1] + i;
        const predictedValue = Math.max(0, Math.round(slope * nextIndex + intercept));
        future.push({
          periodIndex: nextIndex,
          predictedCount: predictedValue
        });
      }
      
      predictions[category] = {
        historical: data,
        predicted: future,
        trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable'
      };
    });
    
    return predictions;
  }
  
  // Get emerging hotspots
  async getEmergingHotspots() {
    return new Promise((resolve, reject) => {
      // Get reports from last 2 weeks
      const query = `
        SELECT * FROM reports 
        WHERE created_at >= date('now', '-14 days')
        AND is_primary = 1
        ORDER BY created_at DESC
      `;
      
      db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Parse AI analysis
          const reports = rows.map(row => ({
            ...row,
            ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null
          }));
          
          // Cluster locations to find hotspots
          const clusters = this.clusterLocations(reports, 100); // 100m radius
          
          // Filter for "emerging" hotspots (clusters with 3+ reports in 2 weeks)
          const emergingHotspots = clusters
            .filter(cluster => cluster.count >= 3)
            .map(cluster => {
              // Find most common category and severity
              const topCategory = Object.keys(cluster.categories)
                .reduce((a, b) => cluster.categories[a] > cluster.categories[b] ? a : b);
              
              const topSeverity = Object.keys(cluster.severity)
                .reduce((a, b) => cluster.severity[a] > cluster.severity[b] ? a : b);
              
              return {
                ...cluster,
                topCategory,
                topSeverity,
                // Calculate growth rate (reports in last week vs previous week)
                growthRate: this.calculateGrowthRate(cluster.reports)
              };
            })
            .sort((a, b) => b.growthRate - a.growthRate); // Sort by growth rate
            
          resolve(emergingHotspots);
        }
      });
    });
  }
  
  // Calculate growth rate for a cluster
  calculateGrowthRate(reports) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentReports = reports.filter(r => new Date(r.created_at) >= oneWeekAgo);
    const olderReports = reports.filter(r => new Date(r.created_at) < oneWeekAgo);
    
    if (olderReports.length === 0) return 100; // 100% growth if no older reports
    if (recentReports.length === 0) return 0; // 0% growth if no recent reports
    
    return ((recentReports.length - olderReports.length) / olderReports.length) * 100;
  }
  
  // Get overall analytics data
  async getPredictiveAnalytics() {
    try {
      // Get reports by week
      const weeklyData = await this.getReportsByTimePeriod('week');
      
      // Get seasonal trends
      const seasonalTrends = await this.getSeasonalTrends();
      
      // Get emerging hotspots
      const hotspots = await this.getEmergingHotspots();
      
      // Predict future trends
      const predictions = this.predictTrends(weeklyData);
      
      return {
        weeklyTrends: weeklyData,
        seasonalTrends: seasonalTrends,
        emergingHotspots: hotspots,
        predictions: predictions,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating predictive analytics:', error);
      throw error;
    }
  }
}

module.exports = new PredictiveAnalyticsService();