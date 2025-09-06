import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import twilio from 'twilio';

// Import new services
import LanguageDetector from './services/languageDetector';
import SalesFunnel from './services/salesFunnel';
import WhatsAppService from './services/whatsappService';
import QRPaymentService from './services/qrPayment';
import GoogleIntegration from './services/googleIntegration';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Initialize services
const languageDetector = new LanguageDetector(process.env.GOOGLE_TRANSLATE_API_KEY);
const salesFunnel = new SalesFunnel(pool);
const whatsappService = WhatsAppService.fromEnv();
const qrPaymentService = new QRPaymentService();
const googleIntegration = new GoogleIntegration();

// Business configurations
const businessConfigs = new Map();

// Initialize database with enhanced tables
async function initDatabase() {
  try {
    // Bot configs table with enhanced fields
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_configs (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(100) UNIQUE NOT NULL,
        business_name VARCHAR(200) NOT NULL,
        business_type VARCHAR(50) NOT NULL,
        system_prompt TEXT NOT NULL,
        ai_model VARCHAR(50) DEFAULT 'gpt-4o',
        telegram_enabled BOOLEAN DEFAULT false,
        whatsapp_enabled BOOLEAN DEFAULT false,
        telegram_token VARCHAR(200),
        whatsapp_provider VARCHAR(50),
        whatsapp_config JSONB,
        google_drive_folder_id VARCHAR(200),
        google_sheets_prices_id VARCHAR(200),
        google_sheets_leads_id VARCHAR(200),
        kaspi_merchant_id VARCHAR(100),
        halyk_iin VARCHAR(100),
        manager_telegram_id VARCHAR(100),
        manager_whatsapp VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Enhanced chat history with language detection
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(100) NOT NULL,
        platform VARCHAR(20) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        response TEXT,
        language VARCHAR(10),
        funnel_step VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Leads table for sales funnel
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        platform VARCHAR(20) NOT NULL,
        language VARCHAR(10),
        product_interest TEXT,
        purpose TEXT,
        budget TEXT,
        name VARCHAR(200),
        phone VARCHAR(50),
        email VARCHAR(200),
        status VARCHAR(50) DEFAULT 'new',
        assigned_to VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(100) UNIQUE NOT NULL,
        business_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2),
        currency VARCHAR(10),
        description TEXT,
        status VARCHAR(50),
        provider VARCHAR(50),
        qr_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации БД:', error);
  }
}

// Telegram Bot instances
const telegramBots = new Map<string, TelegramBot>();

// Enhanced Telegram bot initialization
function initTelegramBot(businessId: string, token: string, config: any) {
  if (!token) return;
  
  const bot = new TelegramBot(token, { polling: true });
  
  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    
    // Detect language
    const langResult = await languageDetector.detect(msg.text || '');
    
    // Initialize sales funnel
    salesFunnel.initFunnel(userId, 'telegram', businessId, langResult.language);
    
    const welcomeMessages = {
      kz: 'Сәлем! Мен сіздің виртуалды көмекшіңізбін. Сізге қалай көмектесе аламын?',
      ru: 'Здравствуйте! Я ваш виртуальный помощник. Как я могу вам помочь?',
      en: 'Hello! I am your virtual assistant. How can I help you?'
    };
    
    await bot.sendMessage(chatId, welcomeMessages[langResult.language]);
    
    // Send first funnel question
    const firstQuestion = salesFunnel.getCurrentQuestion(userId, 'telegram');
    if (firstQuestion) {
      await bot.sendMessage(chatId, firstQuestion);
    }
  });
  
  // Handle /stop command
  bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    
    salesFunnel.resetFunnel(userId, 'telegram');
    
    await bot.sendMessage(chatId, 'Спасибо за общение! До свидания! / Сау болыңыз!', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Начать заново / Қайта бастау', callback_data: 'restart' }
        ]]
      }
    });
  });
  
  // Handle regular messages
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return; // Skip commands
    
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const userId = msg.from?.id.toString() || chatId.toString();
    
    console.log(`[Telegram] ${businessId}: ${text}`);
    
    // Detect language
    const langResult = await languageDetector.detect(text);
    
    // Check if user is in sales funnel
    if (salesFunnel.isInFunnel(userId, 'telegram')) {
      const result = await salesFunnel.processAnswer(userId, 'telegram', text);
      
      if (result.summary) {
        await bot.sendMessage(chatId, result.summary, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Оплатить', callback_data: 'pay' }],
              [{ text: '📞 Связаться с менеджером', callback_data: 'manager' }],
              [{ text: '📋 Посмотреть каталог', url: `https://drive.google.com/${config.google_drive_folder_id}` }]
            ]
          }
        });
      } else if (result.nextQuestion) {
        await bot.sendMessage(chatId, result.nextQuestion);
      }
      
      if (result.isComplete) {
        salesFunnel.resetFunnel(userId, 'telegram');
      }
    } else {
      // Regular AI response
      const response = await generateResponse(businessId, text, 'telegram', userId, langResult.language);
      if (response) {
        await bot.sendMessage(chatId, response, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛒 Сделать заказ', callback_data: 'order' }],
              [{ text: '💬 Менеджер', callback_data: 'manager' }],
              [{ text: '📍 Навигация', url: 'https://2gis.kz' }]
            ]
          }
        });
      }
    }
  });
  
  // Handle callback queries
  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg?.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id.toString();
    
    if (!chatId) return;
    
    switch (data) {
      case 'restart':
        salesFunnel.initFunnel(userId, 'telegram', businessId, 'ru');
        const firstQuestion = salesFunnel.getCurrentQuestion(userId, 'telegram');
        if (firstQuestion) {
          await bot.sendMessage(chatId, firstQuestion);
        }
        break;
        
      case 'order':
        salesFunnel.initFunnel(userId, 'telegram', businessId, 'ru');
        const orderQuestion = salesFunnel.getCurrentQuestion(userId, 'telegram');
        if (orderQuestion) {
          await bot.sendMessage(chatId, orderQuestion);
        }
        break;
        
      case 'pay':
        // Generate QR code for payment
        const payment = await qrPaymentService.generateKaspiQR(
          config.kaspi_merchant_id || '1234567890',
          10000,
          'Оплата заказа',
          userId,
          businessId
        );
        
        if (payment.qrImage) {
          const buffer = Buffer.from(payment.qrImage.split(',')[1], 'base64');
          await bot.sendPhoto(chatId, buffer, {
            caption: 'Отсканируйте QR-код для оплаты через Kaspi'
          });
        }
        break;
        
      case 'manager':
        // Notify manager
        if (config.manager_telegram_id) {
          await bot.sendMessage(config.manager_telegram_id, 
            `🆕 Новый клиент требует внимания!\n` +
            `Пользователь: @${callbackQuery.from.username || userId}\n` +
            `ID: ${userId}\n` +
            `Бизнес: ${businessId}`
          );
        }
        
        await bot.sendMessage(chatId, 
          'Менеджер свяжется с вами в ближайшее время! / Менеджер жақын арада сізбен байланысады!'
        );
        break;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
  });
  
  telegramBots.set(businessId, bot);
  console.log(`✅ Telegram бот инициализирован для ${businessId}`);
}

// Enhanced AI response generation with language support
async function generateResponse(
  businessId: string, 
  message: string, 
  platform: string, 
  userId: string,
  language: 'kz' | 'ru' | 'en' = 'ru'
): Promise<string> {
  try {
    // Get business config
    const configResult = await pool.query(
      'SELECT * FROM bot_configs WHERE business_id = $1',
      [businessId]
    );
    
    if (configResult.rows.length === 0) {
      return language === 'kz' 
        ? 'Кешіріңіз, бот конфигурацияланбаған.'
        : 'Извините, бот не настроен.';
    }
    
    const config = configResult.rows[0];
    
    // Save message to history with language
    await pool.query(
      'INSERT INTO chat_history (business_id, platform, user_id, message, language) VALUES ($1, $2, $3, $4, $5)',
      [businessId, platform, userId, message, language]
    );
    
    // Get chat history
    const historyResult = await pool.query(
      'SELECT message, response FROM chat_history WHERE business_id = $1 AND user_id = $2 ORDER BY timestamp DESC LIMIT 5',
      [businessId, userId]
    );
    
    if (!openai) {
      return language === 'kz'
        ? 'OpenAI API конфигурацияланбаған.'
        : 'OpenAI API не настроен.';
    }
    
    // Language-specific system prompt addon
    const languagePrompts = {
      kz: 'Жауаптарыңызды қазақ тілінде беріңіз.',
      ru: 'Отвечайте на русском языке.',
      en: 'Respond in English.'
    };
    
    // Generate response with OpenAI
    const messages = [
      { role: 'system' as const, content: `${config.system_prompt}\n\n${languagePrompts[language]}` },
      ...historyResult.rows.reverse().flatMap(row => [
        { role: 'user' as const, content: row.message },
        ...(row.response ? [{ role: 'assistant' as const, content: row.response }] : [])
      ]),
      { role: 'user' as const, content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: config.ai_model || 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    const response = completion.choices[0].message.content || 'Извините, не удалось сгенерировать ответ.';
    
    // Save response to history
    await pool.query(
      'UPDATE chat_history SET response = $1 WHERE business_id = $2 AND user_id = $3 AND message = $4',
      [response, businessId, userId, message]
    );
    
    return response;
  } catch (error) {
    console.error('Error generating response:', error);
    return language === 'kz'
      ? 'Қате пайда болды. Кейінірек қайталап көріңіз.'
      : 'Произошла ошибка. Попробуйте позже.';
  }
}

// Enhanced WhatsApp webhook
app.post('/webhook/whatsapp/:provider?', async (req, res) => {
  const provider = req.params.provider || 'twilio';
  
  // Validate webhook
  if (!whatsappService.validateWebhook(req, provider)) {
    return res.status(401).send('Unauthorized');
  }
  
  // Handle webhook verification (for WhatsApp Business API)
  if (req.method === 'GET' && provider === 'whatsapp-business') {
    const challenge = req.query['hub.challenge'];
    return res.send(challenge);
  }
  
  // Process incoming message
  let from: string = '';
  let body: string = '';
  let to: string = '';
  
  if (provider === 'twilio') {
    ({ From: from, Body: body, To: to } = req.body);
    from = from?.replace('whatsapp:', '') || '';
    to = to.replace('whatsapp:', '');
  } else if (provider === 'whatsapp-business') {
    // Parse WhatsApp Business API format
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    
    if (!message) {
      return res.sendStatus(200);
    }
    
    from = message.from;
    body = message.text?.body || '';
    to = value.metadata.phone_number_id;
  } else if (provider === '360dialog') {
    // Parse 360Dialog format
    const message = req.body.messages?.[0];
    if (!message) {
      return res.sendStatus(200);
    }
    
    from = message.from;
    body = message.text?.body || '';
    to = req.body.recipient_id;
  }
  
  // Find business by WhatsApp configuration
  const result = await pool.query(
    'SELECT * FROM bot_configs WHERE whatsapp_enabled = true',
    []
  );
  
  if (result.rows.length > 0 && from && body) {
    const config = result.rows[0];
    const businessId = config.business_id;
    
    // Detect language
    const langResult = await languageDetector.detect(body);
    
    // Check if user is in sales funnel
    if (salesFunnel.isInFunnel(from, 'whatsapp')) {
      const funnelResult = await salesFunnel.processAnswer(from, 'whatsapp', body);
      
      if (funnelResult.summary) {
        await whatsappService.sendMessage(from, funnelResult.summary, provider, [
          { text: '💳 Оплатить', id: 'pay' },
          { text: '📞 Менеджер', id: 'manager' }
        ]);
      } else if (funnelResult.nextQuestion) {
        await whatsappService.sendMessage(from, funnelResult.nextQuestion, provider);
      }
    } else {
      // Regular AI response
      const response = await generateResponse(businessId, body, 'whatsapp', from, langResult.language);
      
      if (response) {
        await whatsappService.sendMessage(from, response, provider, [
          { text: '🛒 Заказать', id: 'order' },
          { text: '💬 Менеджер', id: 'manager' }
        ]);
      }
    }
  }
  
  res.sendStatus(200);
});

// API endpoints remain the same with enhancements...
// [Previous API endpoints code here with added Google integration support]

// QR Payment callback endpoint
app.post('/api/payments/callback', async (req, res) => {
  const { paymentId, status, signature } = req.body;
  
  // TODO: Verify signature based on provider
  
  const updated = qrPaymentService.updatePaymentStatus(paymentId, status);
  
  if (updated) {
    // Save to database
    const payment = qrPaymentService.getPayment(paymentId);
    if (payment) {
      await pool.query(
        `INSERT INTO payments (payment_id, business_id, user_id, amount, currency, description, status, provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (payment_id) DO UPDATE SET status = $7, updated_at = CURRENT_TIMESTAMP`,
        [payment.paymentId, payment.businessId, payment.userId, payment.amount, 
         payment.currency, payment.description, payment.status, payment.provider]
      );
    }
    
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Payment not found' });
  }
});

// Google Sheets integration endpoints
app.get('/api/products/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { search } = req.query;
    
    const config = await pool.query(
      'SELECT google_sheets_prices_id FROM bot_configs WHERE business_id = $1',
      [businessId]
    );
    
    if (config.rows.length === 0 || !config.rows[0].google_sheets_prices_id) {
      return res.status(404).json({ error: 'Product sheet not configured' });
    }
    
    await googleIntegration.init();
    
    const products = search
      ? await googleIntegration.searchProducts(config.rows[0].google_sheets_prices_id, search as string)
      : await googleIntegration.getProducts(config.rows[0].google_sheets_prices_id);
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    services: {
      whatsapp: whatsappService.getProvider() ? 'configured' : 'not configured',
      google: googleIntegration.isInitialized() ? 'connected' : 'not connected',
      database: 'connected',
      telegram: telegramBots.size > 0 ? `${telegramBots.size} bots active` : 'no bots'
    }
  });
});

// Initialize and start server
async function start() {
  await initDatabase();
  
  // Initialize Google services
  try {
    await googleIntegration.init();
    console.log('✅ Google сервисы подключены');
  } catch (error) {
    console.log('⚠️  Google сервисы не настроены');
  }
  
  // Load existing bot configs and initialize
  const configs = await pool.query('SELECT * FROM bot_configs WHERE telegram_enabled = true');
  for (const config of configs.rows) {
    if (config.telegram_token) {
      initTelegramBot(config.business_id, config.telegram_token, config);
    }
  }
  
  // Cleanup old funnel states periodically
  setInterval(() => {
    salesFunnel.cleanupOldStates(24);
  }, 60 * 60 * 1000); // Every hour
  
  app.listen(port, () => {
    console.log(`🚀 Сервер запущен на порту ${port}`);
    console.log(`📱 Telegram боты готовы к работе`);
    console.log(`💬 WhatsApp webhook: /webhook/whatsapp`);
    console.log(`🌐 Google интеграция: ${googleIntegration.isInitialized() ? 'активна' : 'не настроена'}`);
  });
}

start().catch(console.error);

export default app;