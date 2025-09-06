# WhatsApp Cloud API Integration Guide

## Overview
This guide explains how to set up WhatsApp Cloud API (Meta) integration alongside existing Twilio integration.

## Prerequisites
1. Meta Business Account
2. WhatsApp Business Account  
3. Phone number verified in WhatsApp Business
4. Meta App with WhatsApp product enabled

## Setup Steps

### 1. Meta Business Configuration

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create or select your app
3. Add WhatsApp product to your app
4. Navigate to WhatsApp > API Setup

### 2. Get Required Credentials

From Meta Business Platform, you'll need:
- **Phone Number ID**: Found in WhatsApp > API Setup
- **Access Token**: Generate a permanent token in WhatsApp > API Setup
- **Verify Token**: Create your own secure token for webhook verification
- **Graph API Version**: Current version (e.g., v23.0)

### 3. Configure Webhook

1. In Meta App Dashboard, go to WhatsApp > Configuration
2. Set Webhook URL: `https://your-domain.com/webhook/wa-cloud`
3. Enter your Verify Token (same as in bot config)
4. Subscribe to webhook fields:
   - messages
   - messaging_postbacks
   - messaging_optins

### 4. Bot Configuration in Admin Panel

1. Open the Bot Admin interface
2. Select or create a bot configuration
3. In "Messengers" tab:
   - Enable WhatsApp Business
   - Select "WhatsApp Cloud API (Meta)" mode
   - Fill in the fields:
     - **Meta Verify Token**: Your custom verification token
     - **Meta WhatsApp Access Token**: From Meta Business
     - **Phone Number ID**: From Meta Business
     - **Graph API Version**: v23.0 (or current)

### 5. Testing

#### Verify Webhook
```bash
# Test webhook verification
curl -X GET "https://your-domain.com/webhook/wa-cloud?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test_challenge"
```

#### Send Test Message
```bash
# Test sending a message
curl -X POST http://localhost:3001/api/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "your_business_id",
    "message": "Test message"
  }'
```

## Database Schema

New fields added to `bot_configs` table:
- `wa_mode`: 'twilio' or 'cloud' (default: 'twilio')
- `meta_verify_token`: Webhook verification token
- `meta_wa_token`: Meta WhatsApp access token
- `phone_number_id`: WhatsApp phone number ID
- `graph_version`: Graph API version (default: 'v23.0')

## API Endpoints

### Webhook Endpoints
- `GET /webhook/wa-cloud`: Webhook verification
- `POST /webhook/wa-cloud`: Receive incoming messages

### Features
- Automatic message read receipts
- Typing indicators
- Retry logic for rate limiting (429) and server errors (5xx)
- Zod validation for webhook payloads
- Comprehensive logging

## Migration from Twilio

No migration required! Both integrations work simultaneously:
- Existing Twilio bots continue working
- New bots can use either Twilio or Cloud API
- Switch between modes in bot configuration

## Troubleshooting

### Webhook Not Verified
- Check verify token matches in both Meta and bot config
- Ensure webhook URL is publicly accessible
- Check server logs for verification attempts

### Messages Not Sending
- Verify access token is valid
- Check phone number ID is correct
- Ensure phone number is verified in WhatsApp Business
- Check Graph API version compatibility

### Rate Limiting
The integration includes automatic retry logic for:
- 429 (Too Many Requests)
- 5xx server errors

## Security Best Practices

1. **Never expose tokens**: Store tokens securely in environment variables
2. **Use HTTPS**: Always use secure connections for webhooks
3. **Validate webhooks**: The integration validates all incoming webhooks
4. **Rotate tokens**: Regularly update access tokens

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify all credentials are correct
3. Test with the provided curl commands
4. Ensure Meta app is in live mode (not development)

## Additional Resources

- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Webhook Setup Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)