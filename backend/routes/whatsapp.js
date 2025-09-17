const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../database.js");
const aiService = require("../aiService.js");

const router = express.Router();

// Middleware to parse URL-encoded bodies (WhatsApp sends data this way)
router.use(express.urlencoded({ extended: true }));

// In-memory storage for user sessions (in production, use Redis or database)
const userSessions = new Map();

// Helper function to download media from WhatsApp with Twilio authentication
async function downloadMedia(mediaUrl, mimeType) {
  try {
    console.log(`Downloading media from: ${mediaUrl}`);
    
    // Get Twilio credentials from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    console.log(`Twilio credentials - SID: ${accountSid ? 'SET' : 'NOT SET'}, Auth: ${authToken ? 'SET' : 'NOT SET'}`);
    
    // Download with Twilio authentication if credentials are available
    if (accountSid && authToken) {
      console.log('Using Twilio authentication');
      const response = await axios({
        method: 'GET',
        url: mediaUrl,
        responseType: 'arraybuffer',
        auth: {
          username: accountSid,
          password: authToken
        }
      });
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate unique filename
      const extension = mimeType.split('/')[1] || 'jpg';
      const filename = `${uuidv4()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Save file
      fs.writeFileSync(filepath, response.data);
      
      console.log(`Media saved to: ${filepath}`);
      return {
        filepath: filepath,
        url: `/uploads/${filename}`
      };
    } else {
      console.log('No Twilio credentials found, attempting download without authentication');
      // Try without authentication as fallback
      const response = await axios({
        method: 'GET',
        url: mediaUrl,
        responseType: 'arraybuffer'
      });
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate unique filename
      const extension = mimeType.split('/')[1] || 'jpg';
      const filename = `${uuidv4()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Save file
      fs.writeFileSync(filepath, response.data);
      
      console.log(`Media saved to: ${filepath}`);
      return {
        filepath: filepath,
        url: `/uploads/${filename}`
      };
    }
  } catch (error) {
    console.error('Error downloading media:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
}

// Helper function to extract location from message body
function extractLocationFromBody(body) {
  // Look for patterns like "lat,long" or "latitude: X, longitude: Y"
  const latLongRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
  const match = body.match(latLongRegex);
  
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2])
    };
  }
  
  return null;
}

// WhatsApp webhook endpoint
router.post("/webhook", async (req, res) => {
  try {
    console.log("Raw WhatsApp request body:", JSON.stringify(req.body, null, 2));
    
    // WhatsApp sends data in different field names, let's check common ones
    const From = req.body.From || req.body.from;
    const Body = req.body.Body || req.body.body || '';
    const MediaUrl0 = req.body.MediaUrl0 || req.body.mediaUrl0;
    const MediaContentType0 = req.body.MediaContentType0 || req.body.mediaContentType0;
    const Latitude = req.body.Latitude || req.body.latitude;
    const Longitude = req.body.Longitude || req.body.longitude;
    
    // Check for location data in different formats
    let latitude = Latitude;
    let longitude = Longitude;
    
    // Sometimes location data comes in different fields
    if (!latitude && req.body.lat) latitude = req.body.lat;
    if (!longitude && req.body.lng) longitude = req.body.lng;
    if (!latitude && req.body.Lat) latitude = req.body.Lat;
    if (!longitude && req.body.Lng) longitude = req.body.Lng;
    
    console.log("Parsed WhatsApp report:", { 
      From, 
      Body, 
      MediaUrl0, 
      MediaContentType0,
      latitude,
      longitude
    });

    // Check if this is a location message
    const isLocationMessage = req.body.MessageType === 'location' || (latitude && longitude);
    
    // Handle location messages
    if (isLocationMessage && From) {
      // Store location in user session
      if (!userSessions.has(From)) {
        userSessions.set(From, {});
      }
      
      const userSession = userSessions.get(From);
      userSession.location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
      userSession.locationTimestamp = Date.now();
      
      console.log(`Stored location for user ${From}: ${latitude}, ${longitude}`);
      
      // If we have a photo waiting for this user, process the complete report
      if (userSession.photoData) {
        console.log('Processing complete report with stored photo and new location');
        return await processCompleteReport(req, res, From, userSession.photoData, userSession.location);
      }
      
      // Ask for photo if location was sent first
      return res.send(`
        <Response>
          <Message>
            📍 Location received! Now please send a photo of the issue you're reporting.
          </Message>
        </Response>
      `);
    }
    
    // Initialize report data
    let imageData = null;
    let photoUrl = null;
    
    // 1. Download the photo if exists
    if (MediaUrl0 && MediaContentType0 && MediaContentType0.startsWith('image/')) {
      try {
        const mediaResult = await downloadMedia(MediaUrl0, MediaContentType0);
        imageData = mediaResult.filepath;
        photoUrl = mediaResult.url;
        console.log(`Downloaded image: ${photoUrl}`);
      } catch (downloadError) {
        console.error('Error downloading image:', downloadError.message);
        // Send error response to user
        return res.send(`
          <Response>
            <Message>
              ⚠️ We couldn't process your photo. Please try sending it again.
            </Message>
          </Response>
        `);
      }
    }
    
    // 2. Extract location if not provided directly
    if ((!latitude || !longitude) && Body) {
      const locationFromBody = extractLocationFromBody(Body);
      if (locationFromBody) {
        latitude = locationFromBody.latitude;
        longitude = locationFromBody.longitude;
        console.log(`Extracted location from message: ${latitude}, ${longitude}`);
      }
    }
    
    // If we have a photo but no location, ask for location
    if (photoUrl && (!latitude || !longitude) && From) {
      // Store photo data in user session
      if (!userSessions.has(From)) {
        userSessions.set(From, {});
      }
      
      const userSession = userSessions.get(From);
      userSession.photoData = {
        imageData,
        photoUrl,
        description: Body || ''
      };
      userSession.photoTimestamp = Date.now();
      
      console.log(`Stored photo for user ${From}, asking for location`);
      
      return res.send(`
        <Response>
          <Message>
            📸 Photo received! Please share your location so we can pinpoint where this issue is.
            
            To share your location:
            1. Tap the paperclip icon (📎)
            2. Select "Location"
            3. Tap "Send This Location"
          </Message>
        </Response>
      `);
    }
    
    // If we have both photo and location, process the report
    if (photoUrl && latitude && longitude) {
      const location = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
      return await processCompleteReport(req, res, From, { imageData, photoUrl, description: Body || '' }, location);
    }
    
    // If we have neither photo nor location, prompt for photo first
    return res.send(`
      <Response>
        <Message>
          📸 Please send a photo of the issue you're reporting.
          
          You can also include:
          - A brief description of the problem
          - Share your location (tap the paperclip icon and select location)
        </Message>
      </Response>
    `);
    
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.send(`
      <Response>
        <Message>
          ⚠️ Could not process your report. Try again.
        </Message>
      </Response>
    `);
  }
});

// Process a complete report with both photo and location
async function processCompleteReport(req, res, From, photoData, location) {
  try {
    const { imageData, photoUrl, description } = photoData;
    const { latitude, longitude } = location;
    
    // Clear user session
    if (From && userSessions.has(From)) {
      userSessions.delete(From);
    }
    
    // 3. Send image to Gemini Vision API for analysis
    let aiAnalysis = null;
    let analysisError = null;
    
    try {
      console.log('Starting AI analysis for WhatsApp image:', imageData);
      // Use a longer timeout for AI analysis (30 seconds)
      aiAnalysis = await Promise.race([
        aiService.analyzeImage(imageData, description || ''),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI analysis timeout after 30 seconds')), 30000)
        )
      ]);
      console.log('AI Analysis completed successfully:', JSON.stringify(aiAnalysis, null, 2));
    } catch (aiError) {
      console.error('AI Analysis error:', aiError.message);
      analysisError = aiError.message;
      // Continue with fallback analysis
      aiAnalysis = aiService.fallbackAnalysis(description || '');
    }
    
    // 4. Prepare report data
    const category = aiAnalysis?.category || 'OTHER';
    const severity = aiAnalysis?.severity || 'MEDIUM';
    const priority = aiAnalysis?.priority || 'MEDIUM';
    const department = aiAnalysis?.departmentResponsible || 'General Administration';
    const estimatedCost = aiAnalysis?.estimatedCost || 'Unknown';
    const estimatedTime = aiAnalysis?.estimatedRepairTime || 'Unknown';
    const urgent = aiAnalysis?.estimatedUrgency === 'IMMEDIATE' || aiAnalysis?.estimatedUrgency === 'URGENT';
    const confidence = aiAnalysis?.confidence || (analysisError ? 30 : 0);
    
    // 5. Store in SQLite DB using the same format as web reports
    const query = `
      INSERT INTO reports (
        description, photo_url, latitude, longitude, status,
        category, severity, priority, department,
        ai_analysis, ai_confidence, estimated_cost, estimated_time, urgent,
        duplicate_count, is_primary,
        created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `;
    
    const params = [
      description || 'Reported via WhatsApp',
      photoUrl,
      latitude,
      longitude,
      category,
      severity,
      priority,
      department,
      JSON.stringify(aiAnalysis),
      confidence,
      estimatedCost,
      estimatedTime,
      urgent ? 1 : 0,
      new Date().toISOString()
    ];
    
    db.run(query, params, function(err) {
      if (err) {
        console.error('Database error:', err.message);
        return res.send(`
          <Response>
            <Message>
              ⚠️ Could not process your report. Try again.
            </Message>
          </Response>
        `);
      }
      
      const reportId = this.lastID;
      console.log(`Report filed successfully with ID: ${reportId}`);
      
      // Send detailed confirmation to user
      let aiStatusMessage = '';
      if (analysisError && analysisError.includes('quota')) {
        aiStatusMessage = `AI Analysis: Free quota exceeded, using keyword analysis (try again tomorrow)`;
      } else if (analysisError) {
        aiStatusMessage = `AI Analysis: Fallback mode (error: ${analysisError.substring(0, 50)}...)`;
      } else {
        aiStatusMessage = `AI Analysis: Completed successfully`;
      }
      
      res.send(`
        <Response>
          <Message>
            ✅ Report Submitted Successfully!
            
            Report ID: #${reportId}
            Issue Type: ${category.replace('_', ' ')}
            Severity: ${severity}
            Confidence: ${confidence}%
            Department: ${department}
            
            Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
            Description: ${description || 'No description provided'}
            
            ${aiStatusMessage}
            
            Our team will review and address this issue soon.
            You can track this report at our website.
          </Message>
        </Response>
      `);
    });
  } catch (err) {
    console.error('Error processing complete report:', err);
    res.send(`
      <Response>
        <Message>
          ⚠️ Could not process your report. Try again.
        </Message>
      </Response>
    `);
  }
}

// WhatsApp status callback endpoint
router.post("/status", (req, res) => {
  console.log("WhatsApp status callback:", req.body);
  res.sendStatus(200);
});

module.exports = router;