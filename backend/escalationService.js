const db = require('./database');

// SLA definitions based on severity and category
const SLA_DEFINITIONS = {
  // Severity-based SLAs (in hours)
  severity: {
    'HIGH': 6,    // 6 hours for high severity issues
    'MEDIUM': 24, // 24 hours for medium severity issues
    'LOW': 72     // 72 hours for low severity issues
  },
  
  // Category-specific overrides (in hours)
  category: {
    'GARBAGE_OVERFLOW': 6,    // 6 hours for garbage overflow
    'WATER_LEAK': 6,          // 6 hours for water leaks
    'DRAIN_BLOCKAGE': 12,     // 12 hours for drain blockage
    'POTHOLE': 24,            // 24 hours for potholes
    'STREET_LIGHT': 24,       // 24 hours for street lights
    'BROKEN_SIDEWALK': 48,    // 48 hours for broken sidewalks
    'ILLEGAL_DUMPING': 12,    // 12 hours for illegal dumping
    'DAMAGED_SIGN': 48,       // 48 hours for damaged signs
    'VEGETATION_OVERGROWTH': 72, // 72 hours for vegetation overgrowth
    'OTHER': 24               // 24 hours for other issues
  }
};

class EscalationService {
  constructor() {
    this.isRunning = false;
  }

  // Get SLA deadline for a report based on its severity and category
  getSlaDeadline(report) {
    // Use category-specific SLA if available, otherwise use severity-based SLA
    const categorySla = SLA_DEFINITIONS.category[report.category];
    const severitySla = SLA_DEFINITIONS.severity[report.severity || 'MEDIUM'];
    
    // Use the stricter (shorter) SLA
    const slaHours = categorySla !== undefined ? categorySla : severitySla;
    
    // Calculate deadline
    const createdAt = new Date(report.created_at || report.timestamp);
    const deadline = new Date(createdAt.getTime() + (slaHours * 60 * 60 * 1000));
    
    return deadline;
  }

  // Check if a report has missed its SLA
  isOverdue(report) {
    if (!report.sla_deadline) return false;
    
    const now = new Date();
    const deadline = new Date(report.sla_deadline);
    
    return now > deadline;
  }

  // Escalate a report by increasing its priority
  escalateReport(reportId) {
    return new Promise((resolve, reject) => {
      // Update report to escalate it
      const query = `
        UPDATE reports 
        SET escalated = 1, 
            priority = 'HIGH',
            status = CASE 
              WHEN status = 'pending' THEN 'pending' 
              WHEN status = 'verified' THEN 'verified' 
              ELSE status 
            END
        WHERE id = ?
      `;
      
      db.run(query, [reportId], function(err) {
        if (err) {
          console.error('Error escalating report:', err.message);
          reject(err);
        } else {
          console.log(`Report #${reportId} has been escalated to HIGH priority`);
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Notify supervisors about escalated reports (placeholder for actual notification system)
  notifySupervisors(report) {
    console.log(`🔔 NOTIFICATION: Report #${report.id} has been escalated!`);
    console.log(`   Category: ${report.category}`);
    console.log(`   Severity: ${report.severity}`);
    console.log(`   Description: ${report.description.substring(0, 50)}...`);
    console.log(`   SLA Deadline: ${report.sla_deadline}`);
    console.log(`   Overdue by: ${this.getHoursOverdue(report)} hours`);
    
    // In a real implementation, this would send emails, SMS, or push notifications
    // to the appropriate supervisors based on department
  }

  // Calculate how many hours a report is overdue
  getHoursOverdue(report) {
    if (!report.sla_deadline) return 0;
    
    const now = new Date();
    const deadline = new Date(report.sla_deadline);
    
    if (now <= deadline) return 0;
    
    const diffMs = now - deadline;
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  // Check all pending reports for escalation
  async checkForEscalations() {
    if (this.isRunning) {
      console.log('Escalation check already running, skipping...');
      return;
    }
    
    this.isRunning = true;
    console.log('🔍 Checking for reports that need escalation...');
    
    try {
      // Get all pending and verified reports that haven't been escalated yet
      const query = `
        SELECT * FROM reports 
        WHERE status IN ('pending', 'verified') 
        AND escalated = 0
        ORDER BY created_at ASC
      `;
      
      const reports = await new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
      let escalatedCount = 0;
      
      for (const report of reports) {
        // Check if report has an SLA deadline
        if (report.sla_deadline && this.isOverdue(report)) {
          try {
            // Escalate the report
            await this.escalateReport(report.id);
            
            // Notify supervisors
            this.notifySupervisors(report);
            
            escalatedCount++;
          } catch (error) {
            console.error(`Error escalating report #${report.id}:`, error);
          }
        }
      }
      
      console.log(`✅ Escalation check complete. ${escalatedCount} reports escalated.`);
      
    } catch (error) {
      console.error('Error during escalation check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Initialize SLA deadlines for existing reports (run once)
  async initializeSlaDeadlines() {
    console.log('🔄 Initializing SLA deadlines for existing reports...');
    
    try {
      // Get all reports without SLA deadlines
      const query = `
        SELECT id, category, severity, created_at, timestamp 
        FROM reports 
        WHERE sla_deadline IS NULL
      `;
      
      const reports = await new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
      let updatedCount = 0;
      
      for (const report of reports) {
        const deadline = this.getSlaDeadline(report);
        
        // Update report with SLA deadline
        const updateQuery = `
          UPDATE reports 
          SET sla_deadline = ?
          WHERE id = ?
        `;
        
        await new Promise((resolve, reject) => {
          db.run(updateQuery, [deadline.toISOString(), report.id], function(err) {
            if (err) {
              reject(err);
            } else {
              if (this.changes > 0) {
                updatedCount++;
              }
              resolve();
            }
          });
        });
      }
      
      console.log(`✅ SLA initialization complete. ${updatedCount} reports updated.`);
      
    } catch (error) {
      console.error('Error initializing SLA deadlines:', error);
    }
  }

  // Start the escalation service with periodic checks
  start(periodMinutes = 30) {
    console.log(`🚀 Starting Escalation Service (checking every ${periodMinutes} minutes)`);
    
    // Run initial SLA initialization
    this.initializeSlaDeadlines();
    
    // Run initial check
    this.checkForEscalations();
    
    // Set up periodic checks
    setInterval(() => {
      this.checkForEscalations();
    }, periodMinutes * 60 * 1000); // Convert minutes to milliseconds
  }
}

module.exports = new EscalationService();