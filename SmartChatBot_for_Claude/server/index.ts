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
import VoiceRecognitionService from './services/voiceRecognition';
import PDFGeneratorService from './services/pdfGenerator';
import DocumentWorkflowService from './services/documentWorkflow';
import { constructionCatalog, searchProducts, calculateTotal, findProductBySKU } from './data/constructionCatalog';
import * as waCloud from './services/waCloud';
import { z } from 'zod';

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
const voiceRecognition = new VoiceRecognitionService(process.env.OPENAI_API_KEY);
const pdfGenerator = new PDFGeneratorService();
const documentWorkflow = new DocumentWorkflowService(googleIntegration);

// User language preferences storage
const userLanguages = new Map<number | string, string>();
// User context for AI conversations
const userContexts = new Map<string, any>();

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
        proposal_template_id VARCHAR(200),
        invoice_template_id VARCHAR(200),
        default_currency VARCHAR(10) DEFAULT 'KZT',
        catalog_enabled BOOLEAN DEFAULT false,
        kaspi_merchant_id VARCHAR(100),
        halyk_iin VARCHAR(100),
        manager_telegram_id VARCHAR(100),
        manager_whatsapp VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS proposal_template_id VARCHAR(200)`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS invoice_template_id VARCHAR(200)`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS default_currency VARCHAR(10) DEFAULT 'KZT'`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS catalog_enabled BOOLEAN DEFAULT false`);

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
  
  // Stop any existing bot for this business to prevent conflicts
  const existingBot = telegramBots.get(businessId);
  if (existingBot) {
    existingBot.stopPolling();
    telegramBots.delete(businessId);
  }
  
  const bot = new TelegramBot(token, { polling: true });
  
  // Handle /start command - Always greet in Russian first and ask for language preference
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    const userName = msg.from?.first_name || 'Клиент';
    
    // Reset any previous funnel state
    salesFunnel.resetFunnel(userId, 'telegram');
    
    // Always greet in Russian first and ask for language preference
    const greeting = `🤖 Здравствуйте, ${userName}!\n\n` +
                    `Я - виртуальный помощник ${config.business_name || businessId}.\n` +
                    `Рад приветствовать вас!\n\n` +
                    `На каком языке вам удобнее общаться?\n` +
                    `Қай тілде сөйлескіңіз келеді?`;
    
    await bot.sendMessage(chatId, greeting, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
            { text: '🇰🇿 Қазақша', callback_data: 'lang_kz' },
            { text: '🇬🇧 English', callback_data: 'lang_en' }
          ]
        ]
      }
    });
    
    // Store default language preference
    userLanguages.set(chatId, 'ru');
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
  
  // Handle regular messages and voice messages
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return; // Skip commands
    
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    let text = msg.text || '';
    
    // Handle voice messages
    if (msg.voice || msg.audio) {
      const fileId = msg.voice?.file_id || msg.audio?.file_id;
      if (fileId && token) {
        await bot.sendMessage(chatId, '🎤 Обрабатываю голосовое сообщение...');
        
        const transcribedText = await voiceRecognition.processTelegramVoice(
          fileId,
          token,
          userLanguages.get(chatId) || 'ru'
        );
        
        if (transcribedText) {
          text = transcribedText;
          await bot.sendMessage(chatId, `📝 Распознано: "${text}"`);
        } else {
          await bot.sendMessage(chatId, '❌ Не удалось распознать голосовое сообщение. Попробуйте еще раз или напишите текстом.');
          return;
        }
      }
    }
    
    if (!text) return;
    
    console.log(`[Telegram] ${businessId}: ${text}`);
    
    // Get user language preference or detect from text
    let userLang = userLanguages.get(chatId) || 'ru';
    
    // Only detect language if enabled in config
    if (config.language_detection) {
      const langResult = await languageDetector.detect(text);
      if (langResult.confidence > 0.7) {
        userLang = langResult.language;
        userLanguages.set(chatId, userLang);
      }
    }
    
    const sendWorkflowResult = async (result: any) => {
      if (!result) return true;

      if (result.status === 'question') {
        if (result.message) {
          await bot.sendMessage(chatId, result.message);
        }
        if (result.question) {
          await bot.sendMessage(chatId, result.question);
        }
        return true;
      }

      if (result.status === 'completed' && result.pdfBuffer) {
        const caption = result.webViewLink
          ? `${result.caption || ''}\n[Открыть в Google Docs](${result.webViewLink})`
          : result.caption;

        await bot.sendDocument(
          chatId,
          result.pdfBuffer,
          { caption: caption || undefined, parse_mode: result.webViewLink ? 'Markdown' : undefined },
          { filename: result.fileName || 'document.pdf', contentType: 'application/pdf' }
        );
        return true;
      }

      if (result.status === 'cancelled' && result.message) {
        await bot.sendMessage(chatId, result.message);
        return true;
      }

      if (result.status === 'error' && result.message) {
        await bot.sendMessage(chatId, result.message);
        return true;
      }

      return false;
    };

    if (documentWorkflow.isCollecting(userId, 'telegram')) {
      const workflowResult = await documentWorkflow.processAnswer(userId, 'telegram', text);
      await sendWorkflowResult(workflowResult);
      return;
    }

    const lowerText = text.toLowerCase();
    const defaultWorkflowValues = {
      BUSINESS_NAME: config.business_name,
      COMPANY_NAME: config.business_name,
      BUSINESS_PHONE: config.manager_whatsapp || '',
      DEFAULT_CURRENCY: config.default_currency || 'KZT'
    };

    if (config.invoice_template_id) {
      const invoiceDirectMatch = /(\bсч[её]т\b|счет на оплату|сч[её]т на оплату|invoice|выставить счет)/.test(lowerText);
      if (invoiceDirectMatch) {
        const startResult = await documentWorkflow.startWorkflow({
          userId,
          platform: 'telegram',
          type: 'invoice',
          templateId: config.invoice_template_id,
          folderId: config.google_drive_folder_id || undefined,
          language: userLang as any,
          businessId,
          businessName: config.business_name,
          defaultValues: defaultWorkflowValues,
          outputName: `Invoice-${new Date().toISOString().split('T')[0]}-${userId}`
        });
        await sendWorkflowResult(startResult);
        return;
      }
    }

    if (config.proposal_template_id) {
      const proposalDirectMatch = /(коммерческое предложение|коммерческое|\bкп\b|commercial offer|quotation)/.test(lowerText);
      if (proposalDirectMatch) {
        const startResult = await documentWorkflow.startWorkflow({
          userId,
          platform: 'telegram',
          type: 'proposal',
          templateId: config.proposal_template_id,
          folderId: config.google_drive_folder_id || undefined,
          language: userLang as any,
          businessId,
          businessName: config.business_name,
          defaultValues: defaultWorkflowValues,
          outputName: `Proposal-${new Date().toISOString().split('T')[0]}-${userId}`
        });
        await sendWorkflowResult(startResult);
        return;
      }
    }

    // Always use AI as primary consultant, not sales funnel
    const response = await generateResponse(businessId, text, 'telegram', userId, userLang as any);
    if (response) {
      // Parse response for special actions
      const responseLower = response.toLowerCase();
      const needsQuote = responseLower.includes('коммерческое предложение') ||
                        responseLower.includes('составить кп') ||
                        responseLower.includes('подготовить предложение');
      const needsInvoice = /\bсч[её]т\b/.test(responseLower) ||
                        responseLower.includes('счет на оплату') ||
                        responseLower.includes('invoice');

      const keyboard: any[] = [];

      // Add relevant buttons based on context
      if ((needsQuote || response.includes('₸') || response.includes('цен')) && config.proposal_template_id) {
        keyboard.push([{ text: '📄 Получить КП в PDF', callback_data: 'generate_quote' }]);
      }

      if (needsInvoice && config.invoice_template_id) {
        keyboard.push([{ text: '🧾 Счет на оплату', callback_data: 'generate_invoice' }]);
      }
      
      if (response.toLowerCase().includes('каталог') || response.toLowerCase().includes('товар')) {
        keyboard.push([{ text: '📋 Полный каталог', callback_data: 'show_catalog' }]);
      }
      
      // Always show these options
      keyboard.push([
        { text: '💬 Менеджер', callback_data: 'manager' },
        { text: '📍 Адрес склада', callback_data: 'location' }
      ]);
      
      await bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
      });
    }
  });
  
  // Handle callback queries
  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg?.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id.toString();

    if (!chatId) return;

    const lang = (userLanguages.get(chatId) || 'ru') as 'ru' | 'kz' | 'en';
    const defaultWorkflowValues = {
      BUSINESS_NAME: config.business_name,
      COMPANY_NAME: config.business_name,
      BUSINESS_PHONE: config.manager_whatsapp || '',
      DEFAULT_CURRENCY: config.default_currency || 'KZT'
    };

    const handleWorkflowResult = async (result: any) => {
      if (!result) return;

      if (result.status === 'question') {
        if (result.message) {
          await bot.sendMessage(chatId, result.message);
        }
        if (result.question) {
          await bot.sendMessage(chatId, result.question);
        }
        return;
      }

      if (result.status === 'completed' && result.pdfBuffer) {
        const caption = result.webViewLink
          ? `${result.caption || ''}\n[Открыть в Google Docs](${result.webViewLink})`
          : result.caption;
        await bot.sendDocument(
          chatId,
          result.pdfBuffer,
          { caption: caption || undefined, parse_mode: result.webViewLink ? 'Markdown' : undefined },
          { filename: result.fileName || 'document.pdf', contentType: 'application/pdf' }
        );
        return;
      }

      if ((result.status === 'cancelled' || result.status === 'error') && result.message) {
        await bot.sendMessage(chatId, result.message);
      }
    };

    switch (data) {
      case 'lang_ru':
        userLanguages.set(chatId, 'ru');
        await bot.sendMessage(chatId, 
          '✅ Язык установлен: Русский\n\n' +
          'Чем могу помочь вам сегодня?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛒 Сделать заказ', callback_data: 'order' }],
                [{ text: '💬 Связаться с менеджером', callback_data: 'manager' }],
                [{ text: '📋 Каталог товаров', callback_data: 'catalog' }]
              ]
            }
          }
        );
        break;
        
      case 'lang_kz':
        userLanguages.set(chatId, 'kz');
        await bot.sendMessage(chatId, 
          '✅ Тіл орнатылды: Қазақша\n\n' +
          'Бүгін сізге қалай көмектесе аламын?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛒 Тапсырыс беру', callback_data: 'order' }],
                [{ text: '💬 Менеджермен байланысу', callback_data: 'manager' }],
                [{ text: '📋 Тауарлар каталогы', callback_data: 'catalog' }]
              ]
            }
          }
        );
        break;
        
      case 'lang_en':
        userLanguages.set(chatId, 'en');
        await bot.sendMessage(chatId, 
          '✅ Language set: English\n\n' +
          'How can I help you today?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛒 Place Order', callback_data: 'order' }],
                [{ text: '💬 Contact Manager', callback_data: 'manager' }],
                [{ text: '📋 Product Catalog', callback_data: 'catalog' }]
              ]
            }
          }
        );
        break;
        
      case 'restart':
        salesFunnel.initFunnel(userId, 'telegram', businessId, userLanguages.get(chatId) || 'ru');
        // Don't use sales funnel, just inform about order process
        await bot.sendMessage(chatId, 'Пожалуйста, сообщите мне, что вас интересует, и я помогу вам с выбором и оформлением заказа.');
        break;
        
      case 'order':
        const orderLang = userLanguages.get(chatId) || 'ru';
        await bot.sendMessage(chatId, 'Опишите, какие материалы вам нужны, и я помогу подобрать оптимальные варианты и составить коммерческое предложение.');
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
        
      case 'catalog':
      case 'show_catalog':
        try {
          if (config.google_sheets_prices_id) {
            if (!googleIntegration.isInitialized()) {
              await googleIntegration.init();
            }

            const products = await googleIntegration.getProducts(config.google_sheets_prices_id);

            if (!products.length) {
              await bot.sendMessage(chatId, 'Каталог пока пуст. Добавьте товары в Google Sheets.');
              break;
            }

            const grouped = products.reduce((acc: Map<string, typeof products>, product) => {
              const category = product.category || 'Прочее';
              if (!acc.has(category)) {
                acc.set(category, []);
              }
              acc.get(category)!.push(product);
              return acc;
            }, new Map<string, typeof products>());

            let catalogText = '📋 **Каталог товаров**\n\n';

            for (const [category, items] of grouped) {
              catalogText += `**${category}:**\n`;
              items.slice(0, 5).forEach((item) => {
                const price = item.price ? `${item.price} ${item.currency || config.default_currency || '₸'}` : 'Цена по запросу';
                catalogText += `• ${item.name} — ${price}\n`;
              });
              catalogText += '\n';
            }

            catalogText += `Для полного прайс-листа нажмите 👉 [Google Sheets](https://docs.google.com/spreadsheets/d/${config.google_sheets_prices_id})`;

            await bot.sendMessage(chatId, catalogText, { parse_mode: 'Markdown' });
          } else if (businessId === 'construct_shop' || config.business_type === 'construction') {
            let catalogText = '📋 **КАТАЛОГ СТРОЙМАТЕРИАЛОВ**\n\n';

            for (const [, category] of Object.entries(constructionCatalog.categories)) {
              catalogText += `**${category.name}:**\n`;
              category.products.slice(0, 3).forEach((p: any) => {
                catalogText += `• ${p.name}: ${p.price} ₸/${p.unit}\n`;
              });
              catalogText += '\n';
            }

            catalogText += '🚚 Доставка: 15000₸ по городу\n';
            catalogText += '🏯 Склад: г. Алматы, Рыскулова 57\n';
            catalogText += '☎️ +7 777 123 45 67';

            await bot.sendMessage(chatId, catalogText, { parse_mode: 'Markdown' });
          } else {
            await bot.sendMessage(chatId, 'Каталог товаров пока не подключен.');
          }
        } catch (error) {
          console.error('Failed to load catalog from Google Sheets:', error);
          await bot.sendMessage(chatId, 'Не удалось загрузить каталог из Google Sheets.');
        }
        break;
        
      case 'location':
        await bot.sendMessage(chatId, 
          '📍 **Наш склад:**\n' +
          'г. Алматы, ул. Рыскулова 57\n' +
          'Пн-Сб: 9:00-18:00\n' +
          'Вс: выходной',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'generate_quote':
        if (!config.proposal_template_id) {
          await bot.sendMessage(chatId, 'Шаблон коммерческого предложения не настроен.');
          break;
        }

        if (documentWorkflow.isCollecting(userId, 'telegram')) {
          await bot.sendMessage(chatId, 'Продолжаем заполнение текущего документа.');
          break;
        }

        await handleWorkflowResult(await documentWorkflow.startWorkflow({
          userId,
          platform: 'telegram',
          type: 'proposal',
          templateId: config.proposal_template_id,
          folderId: config.google_drive_folder_id || undefined,
          language: lang,
          businessId,
          businessName: config.business_name,
          defaultValues: defaultWorkflowValues,
          outputName: `Proposal-${new Date().toISOString().split('T')[0]}-${userId}`
        }));
        break;

      case 'generate_invoice':
        if (!config.invoice_template_id) {
          await bot.sendMessage(chatId, 'Шаблон счета не настроен.');
          break;
        }

        if (documentWorkflow.isCollecting(userId, 'telegram')) {
          await bot.sendMessage(chatId, 'Сначала завершите текущий документ или отправьте "отмена".');
          break;
        }

        await handleWorkflowResult(await documentWorkflow.startWorkflow({
          userId,
          platform: 'telegram',
          type: 'invoice',
          templateId: config.invoice_template_id,
          folderId: config.google_drive_folder_id || undefined,
          language: lang,
          businessId,
          businessName: config.business_name,
          defaultValues: defaultWorkflowValues,
          outputName: `Invoice-${new Date().toISOString().split('T')[0]}-${userId}`
        }));
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
    
    // Enhanced system prompt with catalog for construction businesses
    let enhancedSystemPrompt = config.system_prompt;
    
    // For construction businesses, add catalog context when relevant
    if (businessId === 'construct_shop' || config.business_type === 'construction') {
      const keywords = ['обои', 'кирпич', 'цемент', 'блок', 'утеплитель', 'кровля', 'черепица', 'штукатурка', 'гипсокартон', 'ламинат', 'стройматериал', 'ремонт'];
      
      const hasProductQuery = keywords.some(kw => message.toLowerCase().includes(kw));
      
      if (hasProductQuery) {
        let searchResults: any[] = [];

        if (config.google_sheets_prices_id) {
          try {
            if (!googleIntegration.isInitialized()) {
              await googleIntegration.init();
            }
            searchResults = await googleIntegration.searchProducts(config.google_sheets_prices_id, message);
          } catch (error) {
            console.error('Google Sheets product search error:', error);
          }
        }

        if (searchResults.length === 0) {
          searchResults = searchProducts(message);
        }

        if (searchResults.length > 0) {
          enhancedSystemPrompt += `\n\nАктуальные товары по запросу клиента:\n`;
          searchResults.slice(0, 5).forEach(product => {
            const currency = product.currency || config.default_currency || '₸';
            const unitText = product.unit ? `/${product.unit}` : '';
            const availability = product.availability || (product.inStock ? 'В наличии' : 'Нет в наличии');
            enhancedSystemPrompt += `- ${product.name}: ${product.price} ${currency}${unitText} (${availability})\n`;
          });
          enhancedSystemPrompt += `\nПредложите эти товары, рассчитайте необходимое количество и предложите сформировать коммерческое предложение.`;
        }
      }
      
      // Store context for potential quote generation
      const userKey = `${businessId}:${userId}`;
      if (!userContexts.has(userKey)) {
        userContexts.set(userKey, { quotedItems: [] });
      }
    }
    
    // Generate response with OpenAI
    const messages = [
      { role: 'system' as const, content: `${enhancedSystemPrompt}\n\n${languagePrompts[language]}` },
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

// Enhanced WhatsApp webhook with provider
app.post('/webhook/whatsapp/:provider', async (req, res) => {
  const provider = req.params.provider || 'twilio';
  handleWhatsAppWebhook(req, res, provider);
});

// Default WhatsApp webhook (Twilio)
app.post('/webhook/whatsapp', async (req, res) => {
  const provider = 'twilio';
  handleWhatsAppWebhook(req, res, provider);
});

// WhatsApp Cloud API webhook verification (GET)
app.get('/webhook/wa-cloud', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.info('[WhatsApp Cloud] Webhook verification request:', { mode, token: token ? 'present' : 'missing' });
    
    // Find bot config with matching verify token
    const configResult = await pool.query(
      'SELECT business_id FROM bot_configs WHERE meta_verify_token = $1 AND wa_mode = $2',
      [token, 'cloud']
    );
    
    if (mode === 'subscribe' && configResult.rows.length > 0) {
      console.info('[WhatsApp Cloud] Webhook verified for business:', configResult.rows[0].business_id);
      res.status(200).send(challenge);
    } else {
      console.error('[WhatsApp Cloud] Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('[WhatsApp Cloud] Webhook verification error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// WhatsApp Cloud API webhook for incoming messages (POST)
app.post('/webhook/wa-cloud', async (req, res) => {
  try {
    // Zod validation schema
    const webhookSchema = z.object({
      entry: z.array(z.object({
        id: z.string(),
        changes: z.array(z.object({
          value: z.object({
            messaging_product: z.string(),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string()
            }),
            messages: z.array(z.object({
              from: z.string(),
              id: z.string(),
              timestamp: z.string(),
              text: z.object({
                body: z.string()
              }),
              type: z.string()
            })).optional()
          })
        }))
      }))
    });
    
    // Validate webhook payload
    const validationResult = webhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('[WhatsApp Cloud] Invalid webhook payload:', validationResult.error);
      return res.status(400).send('Bad Request');
    }
    
    // Extract incoming message
    const incoming = waCloud.extractIncoming(req.body);
    
    if (!incoming.isValid) {
      console.info('[WhatsApp Cloud] No valid message to process');
      return res.status(200).send('OK');
    }
    
    const { from, text, messageId } = incoming;
    console.info(`[WhatsApp Cloud] Received message from ${from}: ${text}`);
    
    // Get phone_number_id from webhook
    const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    
    // Find bot config by phone_number_id
    const configResult = await pool.query(
      'SELECT * FROM bot_configs WHERE phone_number_id = $1 AND wa_mode = $2',
      [phoneNumberId, 'cloud']
    );
    
    if (configResult.rows.length === 0) {
      console.error('[WhatsApp Cloud] No bot config found for phone_number_id:', phoneNumberId);
      return res.status(200).send('OK');
    }
    
    const config = configResult.rows[0];
    const businessId = config.business_id;
    
    // Mark message as read
    if (messageId && config.meta_wa_token) {
      await waCloud.markAsRead(messageId, {
        metaWaToken: config.meta_wa_token,
        phoneNumberId: config.phone_number_id,
        graphVersion: config.graph_version
      });
    }
    
    // Send typing indicator
    if (config.meta_wa_token) {
      await waCloud.sendTypingIndicator(from, {
        metaWaToken: config.meta_wa_token,
        phoneNumberId: config.phone_number_id,
        graphVersion: config.graph_version
      });
    }
    
    // Generate AI response
    const response = await generateResponse(businessId, text, 'whatsapp', from, 'ru');
    
    // Send response via WhatsApp Cloud API
    if (response && config.meta_wa_token) {
      await waCloud.sendText(from, response, {
        metaWaToken: config.meta_wa_token,
        phoneNumberId: config.phone_number_id,
        graphVersion: config.graph_version
      });
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('[WhatsApp Cloud] Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function handleWhatsAppWebhook(req: any, res: any, provider: string) {
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
}

// API Endpoints for bot configuration

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
    const config = req.body;
    
    const existingResult = await pool.query(
      'SELECT * FROM bot_configs WHERE business_id = $1',
      [config.business_id]
    );
    
    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE bot_configs
         SET business_name = $2, business_type = $3, system_prompt = $4,
             ai_model = $5, telegram_enabled = $6, whatsapp_enabled = $7,
             telegram_token = $8, whatsapp_provider = $9, whatsapp_config = $10,
             google_drive_folder_id = $11, google_sheets_prices_id = $12,
             google_sheets_leads_id = $13, proposal_template_id = $14,
             invoice_template_id = $15, default_currency = $16,
             kaspi_merchant_id = $17, halyk_iin = $18, manager_telegram_id = $19,
             manager_whatsapp = $20, catalog_enabled = $21, wa_mode = $22,
             meta_verify_token = $23, meta_wa_token = $24, phone_number_id = $25,
             graph_version = $26,
             updated_at = CURRENT_TIMESTAMP
         WHERE business_id = $1
         RETURNING *`,
        [config.business_id, config.business_name, config.business_type,
         config.system_prompt, config.ai_model || 'gpt-4o',
         config.telegram_enabled || false, config.whatsapp_enabled || false,
         config.telegram_token, config.whatsapp_provider,
         JSON.stringify(config.whatsapp_config || {}),
         config.google_drive_folder_id, config.google_sheets_prices_id,
         config.google_sheets_leads_id, config.proposal_template_id,
         config.invoice_template_id, config.default_currency || 'KZT',
         config.kaspi_merchant_id, config.halyk_iin, config.manager_telegram_id,
         config.manager_whatsapp, config.catalog_enabled || false,
         config.wa_mode || 'twilio', config.meta_verify_token, config.meta_wa_token,
         config.phone_number_id, config.graph_version || 'v23.0']
      );
    } else {
      // Create new
      result = await pool.query(
        `INSERT INTO bot_configs
         (business_id, business_name, business_type, system_prompt, ai_model,
          telegram_enabled, whatsapp_enabled, telegram_token, whatsapp_provider,
          whatsapp_config, google_drive_folder_id, google_sheets_prices_id,
          google_sheets_leads_id, proposal_template_id, invoice_template_id,
          default_currency, kaspi_merchant_id, halyk_iin,
          manager_telegram_id, manager_whatsapp, catalog_enabled, wa_mode,
          meta_verify_token, meta_wa_token, phone_number_id, graph_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         RETURNING *`,
        [config.business_id, config.business_name, config.business_type,
         config.system_prompt, config.ai_model || 'gpt-4o',
         config.telegram_enabled || false, config.whatsapp_enabled || false,
         config.telegram_token, config.whatsapp_provider,
         JSON.stringify(config.whatsapp_config || {}),
         config.google_drive_folder_id, config.google_sheets_prices_id,
         config.google_sheets_leads_id, config.proposal_template_id,
         config.invoice_template_id, config.default_currency || 'KZT',
         config.kaspi_merchant_id, config.halyk_iin,
         config.manager_telegram_id, config.manager_whatsapp,
         config.catalog_enabled || false, config.wa_mode || 'twilio',
         config.meta_verify_token, config.meta_wa_token,
         config.phone_number_id, config.graph_version || 'v23.0']
      );
    }
    
    // Initialize Telegram bot if enabled
    if (config.telegram_enabled && config.telegram_token) {
      initTelegramBot(config.business_id, config.telegram_token, result.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Update bot config
app.put('/api/configs/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const config = req.body;
    
    // Update the configuration
    const result = await pool.query(
      `UPDATE bot_configs SET 
        business_name = $2,
        business_type = $3,
        system_prompt = $4,
        telegram_enabled = $5,
        telegram_token = $6,
        whatsapp_enabled = $7,
        whatsapp_number = $8,
        ai_model = $9,
        whatsapp_provider = $10,
        whatsapp_config = $11,
        google_drive_folder_id = $12,
        google_sheets_prices_id = $13,
        google_sheets_leads_id = $14,
        proposal_template_id = $15,
        invoice_template_id = $16,
        default_currency = $17,
        kaspi_merchant_id = $18,
        halyk_iin = $19,
        bank_account = $20,
        manager_telegram_id = $21,
        manager_whatsapp = $22,
        language_detection = $23,
        sales_funnel = $24,
        qr_payments = $25,
        catalog_enabled = $26,
        wa_mode = $27,
        meta_verify_token = $28,
        meta_wa_token = $29,
        phone_number_id = $30,
        graph_version = $31,
        updated_at = CURRENT_TIMESTAMP
      WHERE business_id = $1
      RETURNING *`,
      [
        businessId,
        config.business_name,
        config.business_type,
        config.system_prompt,
        config.telegram_enabled || false,
        config.telegram_token,
        config.whatsapp_enabled || false,
        config.whatsapp_number,
        config.ai_model || 'gpt-4o',
        config.whatsapp_provider,
        config.whatsapp_config || {},
        config.google_drive_folder_id,
        config.google_sheets_prices_id,
        config.google_sheets_leads_id,
        config.proposal_template_id,
        config.invoice_template_id,
        config.default_currency || 'KZT',
        config.kaspi_merchant_id,
        config.halyk_iin,
        config.bank_account,
        config.manager_telegram_id,
        config.manager_whatsapp,
        config.language_detection !== false,
        config.sales_funnel !== false,
        config.qr_payments || false,
        config.catalog_enabled || false,
        config.wa_mode || 'twilio',
        config.meta_verify_token,
        config.meta_wa_token,
        config.phone_number_id,
        config.graph_version || 'v23.0'
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    const updatedConfig = result.rows[0];
    
    // Restart telegram bot if settings changed
    if (updatedConfig.telegram_enabled && updatedConfig.telegram_token) {
      // Stop existing bot
      const existingBot = telegramBots.get(businessId);
      if (existingBot) {
        existingBot.stopPolling();
        telegramBots.delete(businessId);
      }
      
      // Start new bot with updated config
      initTelegramBot(businessId, updatedConfig.telegram_token, updatedConfig);
    } else {
      // Stop bot if disabled
      const bot = telegramBots.get(businessId);
      if (bot) {
        bot.stopPolling();
        telegramBots.delete(businessId);
      }
    }
    
    res.json(updatedConfig);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
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

// Test message endpoint
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