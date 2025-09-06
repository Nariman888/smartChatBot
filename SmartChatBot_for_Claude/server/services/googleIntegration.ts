// Google Drive and Sheets Integration Service
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface Product {
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  imageUrl?: string;
  inStock: boolean;
}

export interface Lead {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string;
  product: string;
  message: string;
  timestamp: Date;
  source: string;
  status: string;
}

export class GoogleIntegration {
  private auth: OAuth2Client;
  private drive: any;
  private sheets: any;
  private initialized: boolean = false;
  
  constructor() {
    // Initialize OAuth2 client
    this.auth = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  
  // Initialize with service account or OAuth tokens
  async init(credentials?: any) {
    try {
      if (credentials) {
        this.auth.setCredentials(credentials);
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        // Use service account
        const serviceAccount = JSON.parse(
          Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString()
        );
        
        const jwtClient = new google.auth.JWT({
          email: serviceAccount.client_email,
          key: serviceAccount.private_key,
          scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
        });
        
        await jwtClient.authorize();
        this.auth = jwtClient as any;
      }
      
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google services:', error);
      throw error;
    }
  }
  
  // Check if initialized
  isInitialized(): boolean {
    return this.initialized;
  }
  
  // === GOOGLE DRIVE METHODS ===
  
  // Create folder for business
  async createBusinessFolder(businessName: string): Promise<string> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const response = await this.drive.files.create({
      requestBody: {
        name: `${businessName} - AI Bot Data`,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    
    return response.data.id;
  }
  
  // Upload file to Drive
  async uploadFile(
    fileName: string,
    mimeType: string,
    content: Buffer | string,
    folderId?: string
  ): Promise<{ id: string; webViewLink: string }> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const metadata: any = {
      name: fileName,
      mimeType
    };
    
    if (folderId) {
      metadata.parents = [folderId];
    }
    
    const response = await this.drive.files.create({
      requestBody: metadata,
      media: {
        mimeType,
        body: content
      },
      fields: 'id,webViewLink'
    });
    
    // Make file publicly readable
    await this.drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    return {
      id: response.data.id,
      webViewLink: response.data.webViewLink
    };
  }
  
  // List files in folder
  async listFiles(folderId?: string): Promise<any[]> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const query = folderId ? `'${folderId}' in parents` : '';
    
    const response = await this.drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, webViewLink, createdTime)',
      orderBy: 'createdTime desc'
    });
    
    return response.data.files || [];
  }
  
  // Get file content
  async getFileContent(fileId: string): Promise<Buffer> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      response.data
        .on('data', (chunk: any) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
  }
  
  // === GOOGLE SHEETS METHODS ===
  
  // Create price list spreadsheet
  async createPriceSheet(businessName: string, folderId?: string): Promise<string> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const metadata: any = {
      name: `${businessName} - Прайс-лист`,
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };
    
    if (folderId) {
      metadata.parents = [folderId];
    }
    
    const response = await this.drive.files.create({
      requestBody: metadata,
      fields: 'id'
    });
    
    const spreadsheetId = response.data.id;
    
    // Initialize with headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1:G1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['SKU', 'Название', 'Описание', 'Цена', 'Валюта', 'Категория', 'В наличии']]
      }
    });
    
    return spreadsheetId;
  }
  
  // Add product to price sheet
  async addProduct(spreadsheetId: string, product: Product): Promise<void> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          product.sku,
          product.name,
          product.description,
          product.price,
          product.currency,
          product.category,
          product.inStock ? 'Да' : 'Нет'
        ]]
      }
    });
  }
  
  // Get all products from sheet
  async getProducts(spreadsheetId: string): Promise<Product[]> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A2:G'
    });
    
    const rows = response.data.values || [];
    
    return rows.map(row => ({
      sku: row[0] || '',
      name: row[1] || '',
      description: row[2] || '',
      price: parseFloat(row[3]) || 0,
      currency: row[4] || 'KZT',
      category: row[5] || '',
      inStock: row[6] === 'Да'
    }));
  }
  
  // Search products by query
  async searchProducts(spreadsheetId: string, query: string): Promise<Product[]> {
    const products = await this.getProducts(spreadsheetId);
    const lowerQuery = query.toLowerCase();
    
    return products.filter(product =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery) ||
      product.sku.toLowerCase().includes(lowerQuery) ||
      product.category.toLowerCase().includes(lowerQuery)
    );
  }
  
  // Get product by SKU
  async getProductBySKU(spreadsheetId: string, sku: string): Promise<Product | null> {
    const products = await this.getProducts(spreadsheetId);
    return products.find(p => p.sku === sku) || null;
  }
  
  // Create leads spreadsheet
  async createLeadsSheet(businessName: string, folderId?: string): Promise<string> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const metadata: any = {
      name: `${businessName} - Лиды и заявки`,
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };
    
    if (folderId) {
      metadata.parents = [folderId];
    }
    
    const response = await this.drive.files.create({
      requestBody: metadata,
      fields: 'id'
    });
    
    const spreadsheetId = response.data.id;
    
    // Initialize with headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1:I1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['ID', 'Дата', 'Имя', 'Телефон', 'Email', 'Товар/Услуга', 'Сообщение', 'Источник', 'Статус']]
      }
    });
    
    return spreadsheetId;
  }
  
  // Add lead to sheet
  async addLead(spreadsheetId: string, lead: Lead): Promise<void> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A:I',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          lead.id,
          lead.timestamp.toISOString(),
          lead.name,
          lead.phone,
          lead.email || '',
          lead.product,
          lead.message,
          lead.source,
          lead.status
        ]]
      }
    });
  }
  
  // Get leads from sheet
  async getLeads(spreadsheetId: string, limit: number = 100): Promise<Lead[]> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `A2:I${limit + 1}`
    });
    
    const rows = response.data.values || [];
    
    return rows.map(row => ({
      id: row[0] || '',
      businessId: '',
      timestamp: new Date(row[1]),
      name: row[2] || '',
      phone: row[3] || '',
      email: row[4] || '',
      product: row[5] || '',
      message: row[6] || '',
      source: row[7] || '',
      status: row[8] || 'new'
    }));
  }
  
  // Update lead status
  async updateLeadStatus(spreadsheetId: string, leadId: string, status: string): Promise<boolean> {
    if (!this.initialized) throw new Error('Google services not initialized');
    
    // First, find the row with this lead ID
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:A'
    });
    
    const ids = response.data.values || [];
    const rowIndex = ids.findIndex(row => row[0] === leadId);
    
    if (rowIndex === -1) return false;
    
    // Update status column (column I)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `I${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[status]]
      }
    });
    
    return true;
  }
}

export default GoogleIntegration;