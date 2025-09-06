import axios from 'axios';

const API_URL = 'http://localhost:3001';
const TEST_VERIFY_TOKEN = 'test-verify-token-123';
const TEST_PHONE_NUMBER_ID = '123456789';

// Test webhook verification
async function testWebhookVerification() {
  console.log('\n🔍 Testing WhatsApp Cloud webhook verification...');
  
  try {
    const response = await axios.get(`${API_URL}/webhook/wa-cloud`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': TEST_VERIFY_TOKEN,
        'hub.challenge': 'test_challenge_string'
      }
    });
    
    if (response.status === 200) {
      console.log('❌ Verification should fail with non-existent token');
    } else {
      console.log('✅ Webhook verification correctly rejected invalid token');
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Webhook verification correctly rejected invalid token');
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
}

// Test incoming message handling
async function testIncomingMessage() {
  console.log('\n📨 Testing incoming message handling...');
  
  const webhookPayload = {
    entry: [{
      id: 'ENTRY_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15550555555',
            phone_number_id: TEST_PHONE_NUMBER_ID
          },
          messages: [{
            from: '1234567890',
            id: 'MESSAGE_ID',
            timestamp: '1234567890',
            text: {
              body: 'Test message from WhatsApp Cloud API'
            },
            type: 'text'
          }]
        }
      }]
    }]
  };
  
  try {
    const response = await axios.post(`${API_URL}/webhook/wa-cloud`, webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Webhook accepted the message');
    } else {
      console.log('❌ Unexpected response status:', response.status);
    }
  } catch (error) {
    console.log('❌ Error processing webhook:', error.message);
  }
}

// Test invalid webhook payload
async function testInvalidPayload() {
  console.log('\n⚠️  Testing invalid payload handling...');
  
  const invalidPayload = {
    invalid: 'data'
  };
  
  try {
    const response = await axios.post(`${API_URL}/webhook/wa-cloud`, invalidPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 400) {
      console.log('✅ Invalid payload correctly rejected');
    } else if (response.status === 200) {
      console.log('✅ Invalid payload ignored gracefully');
    } else {
      console.log('❌ Unexpected response for invalid payload');
    }
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Invalid payload correctly rejected with 400');
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
}

// Test empty token scenario
async function testEmptyToken() {
  console.log('\n🔐 Testing empty token scenario...');
  
  // This tests the scenario where meta_wa_token is not configured
  const messagePayload = {
    entry: [{
      id: 'ENTRY_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15550555555',
            phone_number_id: 'UNCONFIGURED_PHONE_ID'
          },
          messages: [{
            from: '1234567890',
            id: 'MESSAGE_ID',
            timestamp: '1234567890',
            text: {
              body: 'Test message'
            },
            type: 'text'
          }]
        }
      }]
    }]
  };
  
  try {
    const response = await axios.post(`${API_URL}/webhook/wa-cloud`, messagePayload);
    
    if (response.status === 200) {
      console.log('✅ Request handled gracefully without token');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting WhatsApp Cloud API Integration Tests\n');
  console.log('================================');
  
  await testWebhookVerification();
  await testIncomingMessage();
  await testInvalidPayload();
  await testEmptyToken();
  
  console.log('\n================================');
  console.log('✅ All tests completed!\n');
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_URL}/api/configs`);
    return true;
  } catch (error) {
    console.error('❌ Server is not running on port 3001');
    console.error('Please start the server first: npm run server');
    return false;
  }
}

// Main execution
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  }
})();