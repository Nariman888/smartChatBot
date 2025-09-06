import axios from 'axios';

// Send text message via WhatsApp Cloud API
export async function sendText(
  to: string, 
  body: string, 
  cfg: { 
    metaWaToken: string; 
    phoneNumberId: string; 
    graphVersion?: string 
  }
) {
  const v = cfg.graphVersion || 'v23.0';
  
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${v}/${cfg.phoneNumberId}/messages`,
      { 
        messaging_product: 'whatsapp', 
        to, 
        type: 'text', 
        text: { body } 
      },
      { 
        headers: { 
          Authorization: `Bearer ${cfg.metaWaToken}`, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
    console.info(`[WhatsApp Cloud] Message sent to ${to}:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(`[WhatsApp Cloud] Error sending message:`, error.response?.data || error.message);
    
    // Retry logic for rate limiting and server errors
    if (error.response?.status === 429 || (error.response?.status >= 500 && error.response?.status < 600)) {
      console.info(`[WhatsApp Cloud] Retrying after ${error.response?.status} error...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const retryResponse = await axios.post(
          `https://graph.facebook.com/${v}/${cfg.phoneNumberId}/messages`,
          { 
            messaging_product: 'whatsapp', 
            to, 
            type: 'text', 
            text: { body } 
          },
          { 
            headers: { 
              Authorization: `Bearer ${cfg.metaWaToken}`, 
              'Content-Type': 'application/json' 
            } 
          }
        );
        
        console.info(`[WhatsApp Cloud] Message sent on retry to ${to}:`, retryResponse.data);
        return retryResponse.data;
      } catch (retryError: any) {
        console.error(`[WhatsApp Cloud] Retry failed:`, retryError.response?.data || retryError.message);
        throw retryError;
      }
    }
    
    throw error;
  }
}

// Extract incoming message from webhook payload
export function extractIncoming(body: any) {
  try {
    const change = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    const from = msg?.from;
    const text = msg?.text?.body;
    const messageId = msg?.id;
    const timestamp = msg?.timestamp;
    const contactProfile = change?.contacts?.[0];
    
    return { 
      from, 
      text,
      messageId,
      timestamp,
      contactName: contactProfile?.profile?.name,
      isValid: !!(from && text)
    };
  } catch (error) {
    console.error('[WhatsApp Cloud] Error extracting incoming message:', error);
    return { isValid: false };
  }
}

// Mark message as read
export async function markAsRead(
  messageId: string,
  cfg: { 
    metaWaToken: string; 
    phoneNumberId: string; 
    graphVersion?: string 
  }
) {
  const v = cfg.graphVersion || 'v23.0';
  
  try {
    await axios.post(
      `https://graph.facebook.com/${v}/${cfg.phoneNumberId}/messages`,
      { 
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      },
      { 
        headers: { 
          Authorization: `Bearer ${cfg.metaWaToken}`, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
    console.info(`[WhatsApp Cloud] Message ${messageId} marked as read`);
  } catch (error: any) {
    console.error(`[WhatsApp Cloud] Error marking message as read:`, error.response?.data || error.message);
  }
}

// Send typing indicator
export async function sendTypingIndicator(
  to: string,
  cfg: { 
    metaWaToken: string; 
    phoneNumberId: string; 
    graphVersion?: string 
  }
) {
  const v = cfg.graphVersion || 'v23.0';
  
  try {
    await axios.post(
      `https://graph.facebook.com/${v}/${cfg.phoneNumberId}/messages`,
      { 
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'typing_on'
      },
      { 
        headers: { 
          Authorization: `Bearer ${cfg.metaWaToken}`, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
    console.info(`[WhatsApp Cloud] Typing indicator sent to ${to}`);
  } catch (error: any) {
    console.error(`[WhatsApp Cloud] Error sending typing indicator:`, error.response?.data || error.message);
  }
}

// Helper to validate webhook token
export function validateWebhookToken(
  receivedToken: string | undefined,
  expectedToken: string
): boolean {
  return receivedToken === expectedToken;
}