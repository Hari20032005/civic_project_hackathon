# 🧪 Testing Guide - AI-Powered Civic Issue Reporter

## 🚀 Quick Test Setup

### 1. Start the Application
```bash
# From the project root directory
./start.sh
```

### 2. Test Without Gemini API (Fallback Mode)
The system will work without AI using keyword-based classification:
- Reports with "pothole" → categorized as POTHOLE
- Reports with "light" → categorized as STREET_LIGHT  
- Reports with "garbage" → categorized as GARBAGE_OVERFLOW

### 3. Test With Gemini AI
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to `backend/.env`:
```bash
GEMINI_API_KEY=your-actual-api-key-here
```
3. Restart the backend server

## 📸 Test Cases

### Test Case 1: Submit a Report
1. Go to http://localhost:3000
2. Take/upload a photo of any infrastructure issue
3. Add description (e.g., "Large pothole on main street")
4. Submit and observe AI analysis results

### Test Case 2: View Analytics
1. Submit a few reports with different descriptions
2. Visit http://localhost:5000/analytics
3. Check category distribution and insights

### Test Case 3: Admin Dashboard
1. Go to http://localhost:3000/admin
2. View reports with AI analysis data
3. Update report statuses
4. Check statistics cards

### Test Case 4: Map View
1. Go to http://localhost:3000/map
2. View reports on interactive map
3. Click markers to see AI analysis
4. Check color-coded status indicators

## 🔧 API Testing

### Test AI Analysis Endpoint
```bash
# Check if backend is running
curl http://localhost:5000/health

# Get all reports with AI analysis
curl http://localhost:5000/reports

# Get AI analytics
curl http://localhost:5000/analytics
```

### Test Report Submission
```bash
# Test with form data (replace with actual image file)
curl -X POST http://localhost:5000/report \
  -F "photo=@test-image.jpg" \
  -F "description=Large pothole blocking traffic" \
  -F "latitude=37.7749" \
  -F "longitude=-122.4194"
```

## 🤖 AI Testing Scenarios

### High-Confidence Scenarios
- **Potholes**: Photos of clear road damage
- **Garbage**: Overflowing bins or dumped waste
- **Street Lights**: Broken or dark street lamps
- **Water Issues**: Visible leaks or flooding

### Expected AI Output
```json
{
  "category": "POTHOLE",
  "severity": "HIGH", 
  "confidence": 95,
  "department": "Road Maintenance",
  "urgent": true,
  "technicalAssessment": "Large pothole detected...",
  "estimatedTime": "2-3 days"
}
```

### Low-Confidence Scenarios
- Blurry or unclear images
- Multiple issues in one photo
- Unusual or rare civic problems
- Images without clear civic issues

## 📊 Performance Testing

### Load Testing
```bash
# Install hey for load testing
go install github.com/rakyll/hey@latest

# Test API performance
hey -n 100 -c 10 http://localhost:5000/reports
```

### Database Testing
```bash
# Check SQLite database
cd backend
sqlite3 reports.db ".tables"
sqlite3 reports.db "SELECT * FROM reports LIMIT 5;"
```

## 🐛 Common Issues & Solutions

### Issue: AI Analysis Not Working
**Solution**: Check Gemini API key configuration
```bash
# Verify environment variables
cd backend
echo $GEMINI_API_KEY
```

### Issue: Map Not Loading
**Solution**: Check Leaflet CDN images in components
- MapView.tsx and AdminDashboard.tsx should use CDN URLs

### Issue: File Upload Errors
**Solution**: Check file permissions and upload directory
```bash
ls -la ../uploads/
chmod 755 ../uploads/
```

### Issue: Database Errors
**Solution**: Reset database and restart server
```bash
rm reports.db
node server.js
```

## 🔍 Debug Mode

### Enable Detailed Logging
```javascript
// In aiService.js, add debugging
console.log('AI Analysis Input:', { imagePath, description });
console.log('AI Analysis Output:', analysis);
```

### Monitor AI Processing
```bash
# Watch server logs for AI analysis
cd backend
npm run dev  # Uses nodemon for auto-restart
```

## ✅ Success Criteria

### Basic Functionality
- ✅ Reports can be submitted with photos
- ✅ Location is captured automatically
- ✅ Data persists in database
- ✅ Admin can update statuses

### AI Features
- ✅ Images are analyzed by AI service
- ✅ Issues are categorized correctly
- ✅ Confidence scores are provided
- ✅ Fallback works without API key
- ✅ Analytics endpoint returns insights

### User Experience
- ✅ Mobile-responsive design
- ✅ Fast loading times
- ✅ Intuitive navigation
- ✅ Clear error messages
- ✅ Real-time feedback

## 📱 Mobile Testing

### PWA Testing
1. Open on mobile browser
2. Check "Add to Home Screen" option
3. Test camera functionality
4. Verify GPS location capture
5. Test offline basic functionality

### Responsive Design
- Test on different screen sizes
- Verify touch targets are appropriate
- Check text readability on mobile
- Ensure forms are mobile-friendly

---

## 🎯 Ready for Production?

✅ All test cases pass  
✅ AI accuracy > 80%  
✅ Mobile responsive  
✅ Error handling robust  
✅ Performance acceptable  
✅ Security basics implemented  

**Your AI-powered civic reporter is ready to transform communities! 🏙️✨**