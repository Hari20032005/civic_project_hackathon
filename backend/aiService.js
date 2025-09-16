const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const sharp = require('sharp');

// Initialize Gemini AI - You'll need to set your API key as environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your-gemini-api-key');

class CivicIssueDetector {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Predefined civic issue categories
    this.issueCategories = {
      'POTHOLE': {
        priority: 'HIGH',
        description: 'Road surface damage requiring immediate attention',
        department: 'Road Maintenance',
        estimatedCost: 'Medium',
        estimatedTime: '2-3 days'
      },
      'STREET_LIGHT': {
        priority: 'MEDIUM',
        description: 'Street lighting issues affecting safety',
        department: 'Electrical',
        estimatedCost: 'Low',
        estimatedTime: '1-2 days'
      },
      'GARBAGE_OVERFLOW': {
        priority: 'HIGH',
        description: 'Waste management issue requiring immediate cleanup',
        department: 'Sanitation',
        estimatedCost: 'Low',
        estimatedTime: '1 day'
      },
      'DRAIN_BLOCKAGE': {
        priority: 'HIGH',
        description: 'Drainage system blockage potentially causing flooding',
        department: 'Water Management',
        estimatedCost: 'Medium',
        estimatedTime: '2-3 days'
      },
      'BROKEN_SIDEWALK': {
        priority: 'MEDIUM',
        description: 'Sidewalk damage affecting pedestrian safety',
        department: 'Infrastructure',
        estimatedCost: 'Medium',
        estimatedTime: '3-5 days'
      },
      'WATER_LEAK': {
        priority: 'HIGH',
        description: 'Water supply leak requiring urgent repair',
        department: 'Water Supply',
        estimatedCost: 'High',
        estimatedTime: '1-2 days'
      },
      'DAMAGED_SIGN': {
        priority: 'LOW',
        description: 'Traffic or information signage damage',
        department: 'Traffic Management',
        estimatedCost: 'Low',
        estimatedTime: '2-3 days'
      },
      'ILLEGAL_DUMPING': {
        priority: 'MEDIUM',
        description: 'Unauthorized waste disposal requiring cleanup',
        department: 'Sanitation',
        estimatedCost: 'Medium',
        estimatedTime: '1-2 days'
      },
      'VEGETATION_OVERGROWTH': {
        priority: 'LOW',
        description: 'Overgrown vegetation obstructing paths or visibility',
        department: 'Parks & Gardens',
        estimatedCost: 'Low',
        estimatedTime: '2-3 days'
      },
      'OTHER': {
        priority: 'MEDIUM',
        description: 'General civic issue requiring assessment',
        department: 'General Administration',
        estimatedCost: 'Variable',
        estimatedTime: 'Variable'
      }
    };
  }

  async preprocessImage(imagePath) {
    try {
      // Optimize image for AI analysis - reduce size while maintaining quality
      const processedImagePath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '_processed.jpg');
      
      await sharp(imagePath)
        .resize(800, 800, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(processedImagePath);
        
      return processedImagePath;
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return imagePath; // Return original if processing fails
    }
  }

  async analyzeImage(imagePath, userDescription = '') {
    try {
      // Check if API key is configured
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
        console.warn('Gemini API key not configured, using fallback analysis');
        return this.fallbackAnalysis(userDescription);
      }

      // Preprocess image
      const processedImagePath = await this.preprocessImage(imagePath);
      
      // Read image file
      const imageData = await fs.readFile(processedImagePath);
      const base64Image = imageData.toString('base64');

      // Create the prompt for civic issue detection
      const prompt = `
        You are an expert AI system for analyzing civic infrastructure issues. 
        
        IMPORTANT: Analyze this image FIRST and determine what civic issue is shown based PRIMARILY on what you see in the image. The user description should only be used as supplementary context if needed.
        
        Analyze this image and determine:
        1. What type of civic issue is shown (if any)
        2. The severity level (LOW, MEDIUM, HIGH)
        3. A brief technical assessment
        4. Safety concerns (if any)
        5. Recommended action priority

        ${userDescription ? `User provided additional context: "${userDescription}"` : 'No additional context provided by user.'}

        Available issue categories:
        - POTHOLE: Road surface damage
        - STREET_LIGHT: Street lighting issues
        - GARBAGE_OVERFLOW: Waste management problems
        - DRAIN_BLOCKAGE: Drainage system issues
        - BROKEN_SIDEWALK: Sidewalk damage
        - WATER_LEAK: Water supply leaks
        - DAMAGED_SIGN: Traffic/information signage damage
        - ILLEGAL_DUMPING: Unauthorized waste disposal
        - VEGETATION_OVERGROWTH: Overgrown vegetation
        - OTHER: General civic issues

        Please respond in JSON format:
        {
          "issueDetected": boolean,
          "category": "category_name",
          "confidence": number (0-100),
          "severity": "LOW|MEDIUM|HIGH",
          "technicalAssessment": "detailed description",
          "safetyConcerns": ["concern1", "concern2"],
          "recommendedActions": ["action1", "action2"],
          "estimatedUrgency": "IMMEDIATE|URGENT|MODERATE|LOW"
        }
      `;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
      
      // Enhance with category metadata
      const categoryInfo = this.issueCategories[analysis.category] || this.issueCategories['OTHER'];
      
      return {
        ...analysis,
        departmentResponsible: categoryInfo.department,
        estimatedCost: categoryInfo.estimatedCost,
        estimatedRepairTime: categoryInfo.estimatedTime,
        categoryDescription: categoryInfo.description,
        aiProcessed: true,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI Analysis error:', error);
      // Fallback to rule-based analysis
      return this.fallbackAnalysis(userDescription);
    }
  }

  // Fallback analysis when AI is not available
  fallbackAnalysis(description = '') {
    const descriptionLower = description.toLowerCase();
    
    let category = 'OTHER';
    let severity = 'MEDIUM';
    let assessmentText = 'Image submitted for civic issue reporting';
    
    // Simple keyword matching only if description is provided
    if (description && description.trim()) {
      if (descriptionLower.includes('pothole') || descriptionLower.includes('road') || descriptionLower.includes('crack')) {
        category = 'POTHOLE';
        severity = 'HIGH';
      } else if (descriptionLower.includes('light') || descriptionLower.includes('lamp')) {
        category = 'STREET_LIGHT';
        severity = 'MEDIUM';
      } else if (descriptionLower.includes('garbage') || descriptionLower.includes('trash') || descriptionLower.includes('waste')) {
        category = 'GARBAGE_OVERFLOW';
        severity = 'HIGH';
      } else if (descriptionLower.includes('drain') || descriptionLower.includes('water') || descriptionLower.includes('flood')) {
        category = 'DRAIN_BLOCKAGE';
        severity = 'HIGH';
      } else if (descriptionLower.includes('sidewalk') || descriptionLower.includes('pavement')) {
        category = 'BROKEN_SIDEWALK';
        severity = 'MEDIUM';
      }
      assessmentText = `Issue categorized based on description keywords: ${description}`;
    } else {
      assessmentText = 'Image submitted without description - manual review required for proper categorization';
    }

    const categoryInfo = this.issueCategories[category];

    return {
      issueDetected: true,
      category: category,
      confidence: description && description.trim() ? 60 : 40, // Lower confidence without description
      severity: severity,
      technicalAssessment: assessmentText,
      safetyConcerns: ['Manual assessment required'],
      recommendedActions: ['Verify issue on-site', 'Assign appropriate department'],
      estimatedUrgency: severity === 'HIGH' ? 'URGENT' : 'MODERATE',
      departmentResponsible: categoryInfo.department,
      estimatedCost: categoryInfo.estimatedCost,
      estimatedRepairTime: categoryInfo.estimatedTime,
      categoryDescription: categoryInfo.description,
      aiProcessed: false,
      processedAt: new Date().toISOString(),
      fallbackUsed: true
    };
  }

  // Get issue statistics and insights
  async getIssueInsights(reports) {
    const insights = {
      totalReports: reports.length,
      categoryDistribution: {},
      severityDistribution: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      departmentWorkload: {},
      averageResolutionTime: null,
      mostCommonIssues: [],
      urgentIssues: reports.filter(r => r.ai_analysis?.estimatedUrgency === 'IMMEDIATE' || r.ai_analysis?.estimatedUrgency === 'URGENT').length
    };

    reports.forEach(report => {
      if (report.ai_analysis) {
        // Category distribution
        const category = report.ai_analysis.category || 'OTHER';
        insights.categoryDistribution[category] = (insights.categoryDistribution[category] || 0) + 1;
        
        // Severity distribution
        const severity = report.ai_analysis.severity || 'MEDIUM';
        insights.severityDistribution[severity]++;
        
        // Department workload
        const dept = report.ai_analysis.departmentResponsible || 'General';
        insights.departmentWorkload[dept] = (insights.departmentWorkload[dept] || 0) + 1;
      }
    });

    // Most common issues
    insights.mostCommonIssues = Object.entries(insights.categoryDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return insights;
  }
}

module.exports = new CivicIssueDetector();