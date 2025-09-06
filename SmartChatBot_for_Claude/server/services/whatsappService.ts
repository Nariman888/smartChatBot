// WhatsApp Service with multiple provider support
import twilio from 'twilio';
import axios from 'axios';

export interface WhatsAppProvider {
  send(to: string, message: string, buttons?: any[]): Promise<boolean>;
  sendMedia(to: string, mediaUrl: string, caption?: string): Promise<boolean>;
  validateWebhook(req: any): boolean;
}

// Twilio WhatsApp Provider
export class TwilioProvider implements WhatsAppProvider {
  private client: any;
  private fromNumber: string;
  private authToken: string;
  
  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
    this.authToken = authToken;
  }
  
  async send(to: string, message: string, buttons?: any[]): Promise<boolean> {
    try {
      const msgOptions: any = {
        body: message,
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${to}`
      };
      
      // Add buttons if provided (Twilio supports persistent actions)
      if (buttons && buttons.length > 0) {
        msgOptions.persistentAction = buttons.map(btn => ({
          type: 'button',
          text: btn.text,
          id: btn.id
        }));
      }
      
      await this.client.messages.create(msgOptions);
      return true;
    } catch (error) {
      console.error('Twilio send error:', error);
      return false;
    }
  }
  
  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<boolean> {
    try {
      await this.client.messages.create({
        body: caption || '',
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${to}`,
        mediaUrl: [mediaUrl]
      });
      return true;
    } catch (error) {
      console.error('Twilio media send error:', error);
      return false;
    }
  }
  
  validateWebhook(req: any): boolean {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) return false;
    
    // Validate Twilio signature
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const params = req.body;
    
    return twilio.validateRequest(
      this.authToken,
      signature,
      url,
      params
    );
  }
}

// 360Dialog WhatsApp Provider
export class Dialog360Provider implements WhatsAppProvider {
  private apiKey: string;
  private apiUrl: string = 'https://waba.360dialog.io/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async send(to: string, message: string, buttons?: any[]): Promise<boolean> {
    try {
      const payload: any = {
        to,
        type: 'text',
        text: {
          body: message
        }
      };
      
      // Add interactive buttons if provided
      if (buttons && buttons.length > 0) {
        payload.type = 'interactive';
        payload.interactive = {
          type: 'button',
          body: {
            text: message
          },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.text
              }
            }))
          }
        };
      }
      
      await axios.post(
        `${this.apiUrl}/messages`,
        payload,
        {
          headers: {
            'D360-API-KEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error('360Dialog send error:', error);
      return false;
    }
  }
  
  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.apiUrl}/messages`,
        {
          to,
          type: 'image',
          image: {
            link: mediaUrl,
            caption: caption || ''
          }
        },
        {
          headers: {
            'D360-API-KEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error('360Dialog media send error:', error);
      return false;
    }
  }
  
  validateWebhook(req: any): boolean {
    // 360Dialog uses API key validation
    const apiKey = req.headers['d360-api-key'];
    return apiKey === this.apiKey;
  }
}

// WhatsApp Business API Direct Provider
export class WhatsAppBusinessProvider implements WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private apiUrl: string = 'https://graph.facebook.com/v17.0';
  private webhookToken: string;
  
  constructor(accessToken: string, phoneNumberId: string, webhookToken: string) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.webhookToken = webhookToken;
  }
  
  async send(to: string, message: string, buttons?: any[]): Promise<boolean> {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          body: message
        }
      };
      
      // Add interactive buttons if provided
      if (buttons && buttons.length > 0) {
        payload.type = 'interactive';
        payload.interactive = {
          type: 'button',
          body: {
            text: message
          },
          action: {
            buttons: buttons.map((btn, idx) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${idx}`,
                title: btn.text
              }
            }))
          }
        };
      }
      
      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error('WhatsApp Business API send error:', error);
      return false;
    }
  }
  
  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'image',
          image: {
            link: mediaUrl,
            caption: caption || ''
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error('WhatsApp Business API media send error:', error);
      return false;
    }
  }
  
  validateWebhook(req: any): boolean {
    // Validate webhook token
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode === 'subscribe' && token === this.webhookToken) {
        return true;
      }
    }
    
    // For POST requests, Facebook sends a signature
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;
    
    // TODO: Implement signature validation with crypto
    return true;
  }
}

// WhatsApp Service Manager
export class WhatsAppService {
  private providers: Map<string, WhatsAppProvider> = new Map();
  private defaultProvider?: string;
  
  // Add provider
  addProvider(name: string, provider: WhatsAppProvider, setAsDefault: boolean = false) {
    this.providers.set(name, provider);
    if (setAsDefault || !this.defaultProvider) {
      this.defaultProvider = name;
    }
  }
  
  // Get provider
  getProvider(name?: string): WhatsAppProvider | undefined {
    if (name) {
      return this.providers.get(name);
    }
    return this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined;
  }
  
  // Send message using specified or default provider
  async sendMessage(
    to: string, 
    message: string, 
    providerName?: string,
    buttons?: any[]
  ): Promise<boolean> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      console.error('No WhatsApp provider available');
      return false;
    }
    
    return provider.send(to, message, buttons);
  }
  
  // Send media
  async sendMedia(
    to: string,
    mediaUrl: string,
    caption?: string,
    providerName?: string
  ): Promise<boolean> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      console.error('No WhatsApp provider available');
      return false;
    }
    
    return provider.sendMedia(to, mediaUrl, caption);
  }
  
  // Validate webhook based on provider
  validateWebhook(req: any, providerName?: string): boolean {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return false;
    }
    
    return provider.validateWebhook(req);
  }
  
  // Initialize from environment
  static fromEnv(): WhatsAppService {
    const service = new WhatsAppService();
    
    // Check for Twilio config
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilioProvider = new TwilioProvider(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
        process.env.TWILIO_WHATSAPP_NUMBER || ''
      );
      service.addProvider('twilio', twilioProvider, true);
    }
    
    // Check for 360Dialog config
    if (process.env.DIALOG360_API_KEY) {
      const dialogProvider = new Dialog360Provider(process.env.DIALOG360_API_KEY);
      service.addProvider('360dialog', dialogProvider, !service.defaultProvider);
    }
    
    // Check for WhatsApp Business API config
    if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_ID) {
      const waProvider = new WhatsAppBusinessProvider(
        process.env.WHATSAPP_ACCESS_TOKEN,
        process.env.WHATSAPP_PHONE_ID,
        process.env.WHATSAPP_WEBHOOK_TOKEN || 'webhook_token'
      );
      service.addProvider('whatsapp-business', waProvider, !service.defaultProvider);
    }
    
    return service;
  }
}

export default WhatsAppService;