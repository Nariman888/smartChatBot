import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import twilio from 'twilio';
import OpenAI from 'openai';
import { Pool } from 'pg';

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

// Business configurations
const businessConfigs = new Map();

// Initialize database
async function initDatabase() {
  try {
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
        whatsapp_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(100) NOT NULL,
        platform VARCHAR(20) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        response TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации БД:', error);
  }
}

// Telegram Bot instances
const telegramBots = new Map<string, TelegramBot>();

// Initialize Telegram bot for a business
function initTelegramBot(businessId: string, token: string) {
  if (!token) return;
  
  const bot = new TelegramBot(token, { polling: true });
  
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    console.log(`[Telegram] ${businessId}: ${text}`);
    
    const response = await generateResponse(businessId, text, 'telegram', chatId.toString());
    
    if (response) {
      bot.sendMessage(chatId, response);
    }
  });
  
  telegramBots.set(businessId, bot);
  console.log(`✅ Telegram бот инициализирован для ${businessId}`);
}

// Generate AI response
async function generateResponse(businessId: string, message: string, platform: string, userId: string): Promise<string> {
  try {
    // Get business config
    const configResult = await pool.query(
      'SELECT * FROM bot_configs WHERE business_id = $1',
      [businessId]
    );
    
    if (configResult.rows.length === 0) {
      return 'Извините, бот не настроен. Обратитесь к администратору.';
    }
    
    const config = configResult.rows[0];
    
    // Save message to history
    await pool.query(
      'INSERT INTO chat_history (business_id, platform, user_id, message) VALUES ($1, $2, $3, $4)',
      [businessId, platform, userId, message]
    );
    
    // Get chat history
    const historyResult = await pool.query(
      'SELECT message, response FROM chat_history WHERE business_id = $1 AND user_id = $2 ORDER BY timestamp DESC LIMIT 5',
      [businessId, userId]
    );
    
    if (!openai) {
      return 'OpenAI API не настроен. Пожалуйста, добавьте API ключ.';
    }
    
    // Generate response with OpenAI
    const messages = [
      { role: 'system' as const, content: config.system_prompt },
      ...historyResult.rows.reverse().flatMap(row => [
        { role: 'user' as const, content: row.message },
        ...(row.response ? [{ role: 'assistant' as const, content: row.response }] : [])
      ]),
      { role: 'user' as const, content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: config.ai_model || 'gpt-4o',  // Используем модель из конфига или по умолчанию GPT-4o
      messages,
      max_tokens: 1000,  // Увеличенный лимит для развернутых ответов
      temperature: 0.7,
    });
    
    const response = completion.choices[0]?.message?.content || 'Извините, не смог обработать запрос.';
    
    // Save response to history
    await pool.query(
      'UPDATE chat_history SET response = $1 WHERE business_id = $2 AND user_id = $3 AND message = $4',
      [response, businessId, userId, message]
    );
    
    return response;
  } catch (error) {
    console.error('Ошибка генерации ответа:', error);
    return 'Произошла ошибка при обработке вашего запроса. Попробуйте позже.';
  }
}

// API Endpoints

// Get all bot configs
app.get('/api/configs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bot_configs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching configs:', error);
    res.status(500).json({ error: 'Failed to fetch configs' });
  }
});

// Create or update bot config
app.post('/api/configs', async (req, res) => {
  try {
    const { 
      businessId, 
      businessName, 
      businessType, 
      systemPrompt,
      aiModel, 
      telegramEnabled,
      whatsappEnabled,
      telegramToken,
      whatsappNumber
    } = req.body;
    
    const existingResult = await pool.query(
      'SELECT * FROM bot_configs WHERE business_id = $1',
      [businessId]
    );
    
    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE bot_configs 
         SET business_name = $2, business_type = $3, system_prompt = $4,
             ai_model = $5, telegram_enabled = $6, whatsapp_enabled = $7, 
             telegram_token = $8, whatsapp_number = $9, updated_at = CURRENT_TIMESTAMP
         WHERE business_id = $1
         RETURNING *`,
        [businessId, businessName, businessType, systemPrompt, aiModel || 'gpt-4o',
         telegramEnabled, whatsappEnabled, telegramToken, whatsappNumber]
      );
    } else {
      // Create new
      result = await pool.query(
        `INSERT INTO bot_configs 
         (business_id, business_name, business_type, system_prompt, ai_model,
          telegram_enabled, whatsapp_enabled, telegram_token, whatsapp_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [businessId, businessName, businessType, systemPrompt, aiModel || 'gpt-4o',
         telegramEnabled, whatsappEnabled, telegramToken, whatsappNumber]
      );
    }
    
    // Initialize Telegram bot if enabled
    if (telegramEnabled && telegramToken) {
      initTelegramBot(businessId, telegramToken);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Delete bot config
app.delete('/api/configs/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    // Stop Telegram bot if running
    const bot = telegramBots.get(businessId);
    if (bot) {
      bot.stopPolling();
      telegramBots.delete(businessId);
    }
    
    await pool.query('DELETE FROM bot_configs WHERE business_id = $1', [businessId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

// Get chat history
app.get('/api/history/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const result = await pool.query(
      'SELECT * FROM chat_history WHERE business_id = $1 ORDER BY timestamp DESC LIMIT 100',
      [businessId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// WhatsApp webhook (Twilio)
app.post('/webhook/whatsapp', async (req, res) => {
  const { From, Body, To } = req.body;
  
  // Find business by WhatsApp number
  const result = await pool.query(
    'SELECT business_id FROM bot_configs WHERE whatsapp_number = $1 AND whatsapp_enabled = true',
    [To]
  );
  
  if (result.rows.length > 0) {
    const businessId = result.rows[0].business_id;
    const response = await generateResponse(businessId, Body, 'whatsapp', From);
    
    // Send response via Twilio
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message(response);
    
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  } else {
    res.status(404).send('Business not found');
  }
});

// Test endpoint
app.post('/api/test-message', async (req, res) => {
  try {
    const { businessId, message } = req.body;
    const response = await generateResponse(businessId, message, 'test', 'test-user');
    res.json({ response });
  } catch (error) {
    console.error('Error testing message:', error);
    res.status(500).json({ error: 'Failed to test message' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Initialize and start server
async function start() {
  await initDatabase();
  
  // Load existing bot configs and initialize
  const configs = await pool.query('SELECT * FROM bot_configs WHERE telegram_enabled = true');
  for (const config of configs.rows) {
    if (config.telegram_token) {
      initTelegramBot(config.business_id, config.telegram_token);
    }
  }
  
  app.listen(port, () => {
    console.log(`🚀 Сервер запущен на порту ${port}`);
    console.log(`📱 Telegram боты готовы к работе`);
    console.log(`💬 WhatsApp webhook: /webhook/whatsapp`);
  });
}

start().catch(console.error);