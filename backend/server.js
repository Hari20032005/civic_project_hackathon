require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const aiService = require('./aiService');
const escalationService = require('./escalationService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Start escalation service
escalationService.start(30); // Check every 30 minutes

// API Routes

// POST /report - Create a new report with AI analysis
app.post('/report', upload.single('photo'), async (req, res) => {
  try {
    const { description, latitude, longitude } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    const imagePath = req.file.path;
    
    // Perform AI analysis
    console.log('Starting AI analysis for image:', imagePath);
    const aiAnalysis = await aiService.analyzeImage(imagePath, description);
    
    // Determine priority and urgency flags
    const priority = aiAnalysis.severity || 'MEDIUM';
    const isUrgent = aiAnalysis.estimatedUrgency === 'IMMEDIATE' || aiAnalysis.estimatedUrgency === 'URGENT';
    
    // Check for nearby duplicates using geo + AI similarity
    console.log('Checking for similar nearby reports...');
    const nearbyReports = await aiService.findNearbyReports(
      parseFloat(latitude), 
      parseFloat(longitude), 
      50 // 50 meter radius
    );
    
    let duplicateInfo = null;
    let primaryReportId = null;
    
    // Check similarity with nearby reports
    for (const nearbyReport of nearbyReports) {
      try {
        const nearbyImagePath = path.join(__dirname, '..', nearbyReport.photo_url);
        if (fs.existsSync(nearbyImagePath)) {
          console.log(`Comparing with report #${nearbyReport.id} (${nearbyReport.distance.toFixed(1)}m away)`);
          
          const similarity = await aiService.compareImages(imagePath, nearbyImagePath);
          console.log(`Similarity score: ${similarity.similarityScore}%`);
          
          // If similarity > 80%, mark as duplicate
          if (similarity.similarityScore >= 80) {
            duplicateInfo = {
              primaryReportId: nearbyReport.id,
              similarityScore: similarity.similarityScore,
              distance: nearbyReport.distance,
              reasoning: similarity.reasoning
            };
            primaryReportId = nearbyReport.id;
            console.log(`Duplicate detected! Similar to report #${nearbyReport.id} (${similarity.similarityScore}% similarity)`);
            break; // Found a duplicate, stop checking
          }
        }
      } catch (error) {
        console.error(`Error comparing with report #${nearbyReport.id}:`, error);
        // Continue checking other reports
      }
    }
    
    // Calculate SLA deadline
    const escalationServiceInstance = require('./escalationService');
    const tempReport = {
      category: aiAnalysis.category,
      severity: aiAnalysis.severity,
      created_at: new Date().toISOString()
    };
    const slaDeadline = escalationServiceInstance.getSlaDeadline(tempReport);
    
    if (duplicateInfo) {
      // Handle duplicate report
      const duplicateQuery = `
        INSERT INTO reports (
          description, photo_url, latitude, longitude, status,
          category, severity, priority, department,
          ai_analysis, ai_confidence, estimated_cost, estimated_time, urgent,
          duplicate_of, similarity_score, is_primary,
          sla_deadline, original_priority
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `;
      
      const duplicateParams = [
        description || '',
        photoUrl,
        parseFloat(latitude),
        parseFloat(longitude),
        aiAnalysis.category,
        aiAnalysis.severity,
        priority,
        aiAnalysis.departmentResponsible,
        JSON.stringify({
          ...aiAnalysis,
          duplicateInfo: duplicateInfo
        }),
        aiAnalysis.confidence,
        aiAnalysis.estimatedCost,
        aiAnalysis.estimatedRepairTime,
        isUrgent ? 1 : 0,
        primaryReportId,
        duplicateInfo.similarityScore,
        slaDeadline.toISOString(),
        priority
      ];
      
      // Insert duplicate report
      db.run(duplicateQuery, duplicateParams, function(err) {
        if (err) {
          console.error('Database error saving duplicate:', err.message);
          return res.status(500).json({ error: 'Failed to save report' });
        }
        
        const duplicateReportId = this.lastID;
        
        // Update primary report's duplicate count and merged reports list
        const updatePrimaryQuery = `
          UPDATE reports 
          SET duplicate_count = duplicate_count + 1,
              merged_reports = CASE 
                WHEN merged_reports IS NULL OR merged_reports = '' 
                THEN json_array(?)
                ELSE json_insert(merged_reports, '$[#]', ?)
              END
          WHERE id = ?
        `;
        
        db.run(updatePrimaryQuery, [duplicateReportId, duplicateReportId, primaryReportId], function(updateErr) {
          if (updateErr) {
            console.error('Error updating primary report:', updateErr.message);
          }
          
          res.status(201).json({
            id: duplicateReportId,
            message: 'Report submitted successfully',
            reportId: duplicateReportId,
            isDuplicate: true,
            primaryReportId: primaryReportId,
            similarityScore: duplicateInfo.similarityScore,
            duplicateInfo: {
              message: `This report appears to be similar to an existing report #${primaryReportId} (${duplicateInfo.similarityScore}% similarity, ${duplicateInfo.distance.toFixed(1)}m away).`,
              primaryReportId: primaryReportId,
              similarityScore: duplicateInfo.similarityScore,
              distance: duplicateInfo.distance,
              reasoning: duplicateInfo.reasoning
            },
            aiAnalysis: {
              category: aiAnalysis.category,
              severity: aiAnalysis.severity,
              confidence: aiAnalysis.confidence,
              department: aiAnalysis.departmentResponsible,
              estimatedTime: aiAnalysis.estimatedRepairTime,
              urgent: isUrgent,
              technicalAssessment: aiAnalysis.technicalAssessment
            },
            slaDeadline: slaDeadline
          });
        });
      });
    } else {
      // Handle new unique report
      const query = `
        INSERT INTO reports (
          description, photo_url, latitude, longitude, status,
          category, severity, priority, department,
          ai_analysis, ai_confidence, estimated_cost, estimated_time, urgent,
          duplicate_count, is_primary,
          sla_deadline, original_priority
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
      `;
      
      const params = [
        description || '',
        photoUrl,
        parseFloat(latitude),
        parseFloat(longitude),
        aiAnalysis.category,
        aiAnalysis.severity,
        priority,
        aiAnalysis.departmentResponsible,
        JSON.stringify(aiAnalysis),
        aiAnalysis.confidence,
        aiAnalysis.estimatedCost,
        aiAnalysis.estimatedRepairTime,
        isUrgent ? 1 : 0,
        slaDeadline.toISOString(),
        priority
      ];
      
      db.run(query, params, function(err) {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ error: 'Failed to save report' });
        }
        
        res.status(201).json({
          id: this.lastID,
          message: 'Report submitted successfully',
          reportId: this.lastID,
          isDuplicate: false,
          nearbyReportsChecked: nearbyReports.length,
          aiAnalysis: {
            category: aiAnalysis.category,
            severity: aiAnalysis.severity,
            confidence: aiAnalysis.confidence,
            department: aiAnalysis.departmentResponsible,
            estimatedTime: aiAnalysis.estimatedRepairTime,
            urgent: isUrgent,
            technicalAssessment: aiAnalysis.technicalAssessment
          },
          slaDeadline: slaDeadline
        });
      });
    }
    
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports - Get all reports with AI analysis (sorted by risk priority)
app.get('/reports', (req, res) => {
  const showDuplicates = req.query.includeDuplicates === 'true';
  const query = showDuplicates 
    ? `SELECT * FROM reports 
       ORDER BY 
         escalated DESC,
         urgent DESC,
         CASE severity WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END DESC,
         duplicate_count DESC,
         created_at DESC`
    : `SELECT * FROM reports 
       WHERE is_primary = 1 
       ORDER BY 
         escalated DESC,
         urgent DESC,
         CASE severity WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END DESC,
         duplicate_count DESC,
         created_at DESC`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch reports' });
    }
    
    // Parse AI analysis JSON for each row
    const reportsWithAI = rows.map(row => ({
      ...row,
      ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
      urgent: Boolean(row.urgent),
      escalated: Boolean(row.escalated)
    }));
    
    res.json(reportsWithAI);
  });
});

// PATCH /report/:id - Update report status
app.patch('/report/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['pending', 'verified', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be pending, verified, or resolved' });
  }
  
  // If resolving a report, clear escalation flags
  const query = status === 'resolved' 
    ? 'UPDATE reports SET status = ?, escalated = 0, escalation_notified = 0 WHERE id = ?'
    : 'UPDATE reports SET status = ? WHERE id = ?';
  
  db.run(query, [status, id], function(err) {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to update report' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ 
      message: 'Report status updated successfully',
      clearedEscalation: status === 'resolved'
    });
  });
});

// GET /report/:id - Get single report
app.get('/report/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM reports WHERE id = ?';
  
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch report' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({
      ...row,
      ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
      urgent: Boolean(row.urgent),
      escalated: Boolean(row.escalated)
    });
  });
});

// GET /analytics - Get AI-powered insights
app.get('/analytics', async (req, res) => {
  try {
    const query = 'SELECT * FROM reports';
    
    db.all(query, [], async (err, rows) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch reports for analytics' });
      }
      
      // Parse AI analysis for each report
      const reportsWithAI = rows.map(row => ({
        ...row,
        ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null
      }));
      
      const insights = await aiService.getIssueInsights(reportsWithAI);
      
      // Add escalation statistics
      const escalationStats = {
        totalEscalated: rows.filter(r => r.escalated).length,
        pendingEscalated: rows.filter(r => r.escalated && r.status !== 'resolved').length,
        resolvedEscalated: rows.filter(r => r.escalated && r.status === 'resolved').length
      };
      
      res.json({
        ...insights,
        escalationStats
      });
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// POST /report/:id/resolve - Upload resolution photo and verify with AI
app.post('/report/:id/resolve', upload.single('resolutionPhoto'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Resolution photo is required' });
    }
    
    // Get the original report
    const getReportQuery = 'SELECT * FROM reports WHERE id = ?';
    
    db.get(getReportQuery, [id], async (err, report) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch report' });
      }
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      const resolutionPhotoUrl = `/uploads/${req.file.filename}`;
      const resolutionImagePath = req.file.path;
      const originalImagePath = path.join(__dirname, '..', report.photo_url);
      
      try {
        // Perform AI verification of resolution
        console.log('Starting AI resolution verification...');
        const verification = await aiService.verifyResolution(
          originalImagePath,
          resolutionImagePath,
          report.category || 'OTHER'
        );
        
        // Update report with resolution data and clear escalation flags
        const updateQuery = `
          UPDATE reports 
          SET status = 'resolved',
              resolution_photo_url = ?,
              resolution_date = CURRENT_TIMESTAMP,
              before_after_comparison = ?,
              ai_verification_score = ?,
              escalated = 0,
              escalation_notified = 0
          WHERE id = ?
        `;
        
        db.run(updateQuery, [
          resolutionPhotoUrl,
          JSON.stringify(verification),
          verification.verificationScore,
          id
        ], function(updateErr) {
          if (updateErr) {
            console.error('Database update error:', updateErr.message);
            return res.status(500).json({ error: 'Failed to update report' });
          }
          
          res.status(200).json({
            message: 'Resolution photo uploaded and verified successfully',
            reportId: id,
            verification: {
              resolved: verification.resolved,
              verificationScore: verification.verificationScore,
              quality: verification.resolution_quality,
              recommendation: verification.publicRecommendation,
              improvementDescription: verification.improvementDescription,
              remainingConcerns: verification.remainingConcerns,
              confidence: verification.confidence
            },
            resolutionPhotoUrl: resolutionPhotoUrl
          });
        });
        
      } catch (verificationError) {
        console.error('AI verification error:', verificationError);
        // Even if AI verification fails, we still want to save the resolution
        // This allows admins to manually verify if needed
        
        const updateQuery = `
          UPDATE reports 
          SET status = 'resolved',
              resolution_photo_url = ?,
              resolution_date = CURRENT_TIMESTAMP,
              escalated = 0,
              escalation_notified = 0
          WHERE id = ?
        `;
        
        db.run(updateQuery, [
          resolutionPhotoUrl,
          id
        ], function(updateErr) {
          if (updateErr) {
            console.error('Database update error:', updateErr.message);
            return res.status(500).json({ error: 'Failed to update report' });
          }
          
          res.status(200).json({
            message: 'Resolution photo uploaded successfully (AI verification unavailable)',
            reportId: id,
            resolutionPhotoUrl: resolutionPhotoUrl,
            verification: {
              resolved: false,
              verificationScore: 0,
              quality: 'NEEDS_REVIEW',
              recommendation: 'NEEDS_REVIEW',
              improvementDescription: 'Manual review required - AI verification was unavailable',
              remainingConcerns: ['AI service unavailable', 'Manual verification recommended'],
              confidence: 0
            }
          });
        });
      }
    });
    
  } catch (error) {
    console.error('Error processing resolution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /report/:id/resolution - Get resolution verification details
app.get('/report/:id/resolution', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT id, status, resolution_photo_url, resolution_date, 
           before_after_comparison, ai_verification_score, photo_url
    FROM reports 
    WHERE id = ?
  `;
  
  db.get(query, [id], (err, report) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch resolution data' });
    }
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.status !== 'resolved' || !report.resolution_photo_url) {
      return res.status(404).json({ error: 'No resolution data available' });
    }
    
    const verification = report.before_after_comparison ? JSON.parse(report.before_after_comparison) : null;
    
    res.json({
      reportId: report.id,
      beforePhoto: report.photo_url,
      afterPhoto: report.resolution_photo_url,
      resolutionDate: report.resolution_date,
      verificationScore: report.ai_verification_score,
      verification: verification
    });
  });
});

// GET /escalations - Get escalated reports
app.get('/escalations', (req, res) => {
  const query = `
    SELECT * FROM reports 
    WHERE escalated = 1 
    AND status != 'resolved'
    ORDER BY sla_deadline ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch escalated reports' });
    }
    
    // Parse AI analysis JSON for each row
    const reportsWithAI = rows.map(row => ({
      ...row,
      ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
      urgent: Boolean(row.urgent),
      escalated: Boolean(row.escalated)
    }));
    
    res.json(reportsWithAI);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});