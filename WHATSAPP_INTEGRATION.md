# WhatsApp Bot Integration Setup Guide

## Prerequisites
1. Twilio account (free tier available)
2. Ngrok for exposing localhost to the internet
3. Working backend server

## Setup Steps

### 1. Install Ngrok
```bash
npm install -g ngrok
```

### 2. Start your backend server
```bash
cd backend
npm run dev
```

### 3. Expose your backend with Ngrok
```bash
ngrok http 5000
```

Note the HTTPS URL provided by Ngrok (e.g., https://abc123.ngrok.io)

### 4. Set up Twilio WhatsApp Sandbox
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Messaging → Try it out → WhatsApp Sandbox
3. Note your sandbox number and join code
4. Join the sandbox by sending the join code from your WhatsApp
5. Set the webhook URL to:
   ```
   https://YOUR_NGROK_URL/whatsapp/webhook
   ```
   (Replace YOUR_NGROK_URL with your actual Ngrok URL)

### 5. Testing
1. Send a photo with a description to your Twilio sandbox number
2. The bot will process the image with AI analysis
3. Report will be stored in the database and visible in the admin dashboard

## Usage Instructions for Citizens
1. Send a photo of the civic issue to the WhatsApp number
2. Include location by:
   - Sharing your live location in WhatsApp
   - Including coordinates in the message (e.g., "12.9716,77.5946")
3. Add a brief description of the issue in the message
4. The bot will confirm receipt and provide a report ID

## Features
- Photo analysis with Gemini Vision AI
- Automatic categorization of issues
- Location extraction from shared location or message
- Integration with existing reporting system
- Real-time confirmation messages