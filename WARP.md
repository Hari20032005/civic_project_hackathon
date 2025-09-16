# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Quick Start Commands

### Development Setup
```bash
# One-click startup (installs deps and starts both servers)
./start.sh

# Manual setup - Backend only
cd backend && npm install && npm start

# Manual setup - Frontend only  
cd frontend && npm install && npm start

# Development mode with auto-reload
cd backend && npm run dev
```

### Build Commands
```bash
# Build frontend for production
cd frontend && npm run build

# Test frontend
cd frontend && npm test
```

### Database Operations
```bash
# View database contents
cd backend && sqlite3 reports.db "SELECT * FROM reports LIMIT 5;"

# Reset database (removes all data)
cd backend && rm reports.db && node server.js

# Check database schema
cd backend && sqlite3 reports.db ".schema reports"
```

### AI Configuration
```bash
# Set up Gemini API key
cd backend
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your-actual-api-key-here

# Test without AI (uses fallback keyword detection)
# Just don't set the GEMINI_API_KEY or leave it as default
```

## Architecture Overview

### Project Structure
This is a full-stack application with clear separation between frontend and backend:

- **Backend**: Node.js/Express API with AI-powered image analysis using Google Gemini Vision
- **Frontend**: React 18 + TypeScript with Progressive Web App features
- **Database**: SQLite with enhanced schema for AI analysis data
- **AI Service**: Google Gemini Vision API integration with fallback keyword-based classification

### Core Components

**Backend (`backend/`)**
- `server.js` - Express server with REST endpoints and AI integration
- `aiService.js` - Google Gemini Vision API service for image analysis
- `database.js` - SQLite database initialization with AI-enhanced schema
- `reports.db` - SQLite database storing civic reports with AI analysis

**Frontend (`frontend/src/`)**
- `App.tsx` - Main React app with routing (Report → Map → Admin)
- `components/ReportForm.tsx` - AI-powered issue submission with camera/upload
- `components/MapView.tsx` - Interactive Leaflet map showing all reports
- `components/AdminDashboard.tsx` - Admin interface with AI insights and status management

### AI Integration Architecture

The application has a sophisticated AI analysis pipeline:

1. **Image Processing**: Sharp.js optimizes uploaded images for AI analysis
2. **Google Gemini Vision**: Analyzes images to detect civic issues (potholes, street lights, etc.)
3. **Smart Classification**: AI determines category, severity, department, and estimated repair time
4. **Confidence Scoring**: Each AI analysis includes reliability metrics (0-100%)
5. **Fallback System**: Keyword-based classification when AI is unavailable

### Database Schema Philosophy

The SQLite schema is designed around AI-enhanced civic reporting:
- Core fields: description, photo, location, status
- AI fields: category, severity, department, confidence, technical assessment
- JSON storage: Full AI analysis blob for complex data
- Temporal tracking: Timestamps and AI processing metadata

## Key Development Patterns

### API Response Structure
AI-enhanced endpoints return structured data:
```json
{
  "id": 1,
  "message": "Report submitted successfully",
  "aiAnalysis": {
    "category": "POTHOLE",
    "severity": "HIGH", 
    "confidence": 95,
    "department": "Road Maintenance",
    "urgent": true,
    "technicalAssessment": "Large pothole detected..."
  }
}
```

### Error Handling Strategy
- AI service gracefully falls back to keyword analysis if Gemini API fails
- Frontend handles both AI and fallback responses transparently
- Database operations include proper transaction handling
- File upload includes size limits and type validation

### State Management
- React components use hooks for local state
- Axios for API communication with proper error handling
- Location services integrated with reverse geocoding
- Real-time status updates across admin interface

## Development Guidelines

### AI Service Development
- Always provide fallback functionality when AI is unavailable
- Test with and without GEMINI_API_KEY configured
- Image preprocessing with Sharp.js maintains quality while optimizing for AI
- Confidence scores below 60% should be flagged for manual review

### Frontend Development
- Use TypeScript for all new components
- Follow responsive design patterns (mobile-first)
- Implement proper error boundaries and loading states
- PWA features should work offline for basic functionality

### Backend Development
- Express middleware handles CORS, file uploads, and JSON parsing
- SQLite database operations use proper parameterized queries
- File storage in `/uploads` with UUID naming to prevent conflicts
- Environment variables for configuration (especially AI API keys)

### Testing Approach
- Test both AI-enabled and fallback modes
- Use sample images that clearly show civic issues (potholes, street lights)
- Verify location services work on mobile devices
- Admin dashboard should handle large datasets efficiently

## Common Development Tasks

### Adding New Civic Issue Categories
1. Update `aiService.js` issueCategories object
2. Train/test AI prompts for new category detection
3. Update frontend UI to display new categories
4. Add database migration if needed

### Modifying AI Analysis
1. Update prompt in `aiService.js` analyzeImage method
2. Test with various image types and qualities
3. Adjust confidence thresholds as needed
4. Update fallback keyword detection

### Database Schema Changes
1. Add new columns in `database.js` initializeDatabase function
2. Handle existing data migration properly
3. Update API responses to include new fields
4. Test with existing reports database

## Environment Configuration

### Required Environment Variables
```bash
# Backend (.env)
GEMINI_API_KEY=your-gemini-api-key-here  # Required for AI features
PORT=5000                                # Server port
NODE_ENV=development                     # Environment mode
```

### Optional Configuration
```bash
# Advanced configuration
MAX_FILE_SIZE=5242880                   # 5MB upload limit
UPLOAD_PATH=../uploads                  # Upload directory
ALLOWED_ORIGINS=http://localhost:3000   # CORS origins
DB_PATH=./reports.db                    # SQLite database path
```

## Important Notes

### AI Service Considerations
- Gemini API key is required for full AI functionality
- Without API key, system uses keyword-based fallback classification
- Image preprocessing occurs before AI analysis for optimal results
- Confidence scoring helps identify reports needing manual review

### Mobile & PWA Features
- Progressive Web App installable from browser
- Camera access for direct photo capture
- GPS location services with address resolution
- Responsive design optimized for mobile reporting

### Production Deployment
- Environment variables must be set for production
- Upload directory needs proper file permissions
- SQLite database should be backed up regularly
- Consider image storage limits and cleanup policies

### Performance Considerations
- Images are compressed and optimized before AI analysis
- Database queries are indexed on commonly filtered fields
- Frontend uses lazy loading and proper state management
- Map rendering optimized for large numbers of reports

This civic issue reporter leverages AI to transform how communities report and manage infrastructure problems, providing intelligent analysis while maintaining reliability through fallback systems.