require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const aiService = require('./aiService');

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

// API Routes

// POST /report - Create a new report with AI analysis
app.post('/report', upload.single('photo'), async (req, res) => {
  try {
    const { description, latitude, longitude } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }
    
    if (!description || !latitude || !longitude) {
      return res.status(400).json({ error: 'Description, latitude, and longitude are required' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    const imagePath = req.file.path;
    
    // Perform AI analysis
    console.log('Starting AI analysis for image:', imagePath);
    const aiAnalysis = await aiService.analyzeImage(imagePath, description);
    
    // Determine priority and urgency flags
    const priority = aiAnalysis.severity || 'MEDIUM';
    const isUrgent = aiAnalysis.estimatedUrgency === 'IMMEDIATE' || aiAnalysis.estimatedUrgency === 'URGENT';
    
    const query = `
      INSERT INTO reports (
        description, photo_url, latitude, longitude, status,
        category, severity, priority, department,
        ai_analysis, ai_confidence, estimated_cost, estimated_time, urgent
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      description,
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
      isUrgent ? 1 : 0
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
        aiAnalysis: {
          category: aiAnalysis.category,
          severity: aiAnalysis.severity,
          confidence: aiAnalysis.confidence,
          department: aiAnalysis.departmentResponsible,
          estimatedTime: aiAnalysis.estimatedRepairTime,
          urgent: isUrgent,
          technicalAssessment: aiAnalysis.technicalAssessment
        }
      });
    });
    
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports - Get all reports with AI analysis
app.get('/reports', (req, res) => {
  const query = 'SELECT * FROM reports ORDER BY created_at DESC';
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch reports' });
    }
    
    // Parse AI analysis JSON for each row
    const reportsWithAI = rows.map(row => ({
      ...row,
      ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
      urgent: Boolean(row.urgent)
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
  
  const query = 'UPDATE reports SET status = ? WHERE id = ?';
  
  db.run(query, [status, id], function(err) {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Failed to update report' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ message: 'Report status updated successfully' });
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
    
    res.json(row);
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
      res.json(insights);
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
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