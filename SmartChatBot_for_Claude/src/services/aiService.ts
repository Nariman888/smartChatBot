import OpenAI from 'openai';
import type { ChatMessage, BusinessType } from '../types';

class AIService {
  private openai: OpenAI | null = null;

  constructor() {
    // Проверяем наличие API ключа
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }

  async generateResponse(
    messages: ChatMessage[],
    businessType: BusinessType,
    customPrompt?: string
  ): Promise<string> {
    if (!this.openai) {
      return 'Для работы чат-бота необходим API ключ OpenAI. Пожалуйста, настройте его в панели администратора.';
    }

    try {
      const systemMessage = customPrompt || businessType.systemPrompt;
      const conversationHistory = messages.slice(-5).map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          ...conversationHistory
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || 'Извините, не смог обработать ваш запрос.';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return 'Произошла ошибка при обработке запроса. Попробуйте еще раз.';
    }
  }

  checkEscalationNeeded(message: string, escalationKeywords: string[]): boolean {
    const lowerMessage = message.toLowerCase();
    return escalationKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    );
  }

  generateSampleResponse(businessType: BusinessType): string {
    const responses = {
      dental: 'Добро пожаловать в нашу стоматологическую клинику! Я помогу вам записаться на прием или ответить на вопросы о наших услугах. Чем могу помочь?',
      restaurant: 'Добро пожаловать в наш ресторан! Я покажу вам меню, помогу забронировать столик или оформить заказ на доставку. Что вас интересует?',
      autoservice: 'Здравствуйте! Я консультант автосалона. Помогу подобрать автомобиль, расскажу о наличии и ценах, организую тест-драйв. С чего начнем?',
      realestate: 'Добро пожаловать в агентство недвижимости! Помогу найти квартиру или дом вашей мечты, организую показ, расскажу о районах. Что ищете?',
      education: 'Здравствуйте! Я представитель нашего учебного заведения. Расскажу о специальностях, условиях поступления, стоимости обучения. Какая информация интересует?',
      fitness: 'Привет! Добро пожаловать в фитнес-центр! Помогу выбрать абонемент, запишу на занятия, расскажу о тренерах. Готовы начать путь к здоровью?'
    };

    return responses[businessType.id as keyof typeof responses] || 'Здравствуйте! Чем могу помочь?';
  }
}

export const aiService = new AIService();