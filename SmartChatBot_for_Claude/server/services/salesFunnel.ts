// Sales Funnel Service - 3 questions before purchase
import { Pool } from 'pg';

export interface FunnelState {
  userId: string;
  platform: string;
  businessId: string;
  language: 'kz' | 'ru' | 'en';
  currentStep: 'Q1' | 'Q2' | 'Q3' | 'summary' | 'completed';
  answers: {
    q1?: string;
    q2?: string;
    q3?: string;
  };
  startTime: Date;
  metadata?: any;
}

// Questions in different languages
const FUNNEL_QUESTIONS = {
  ru: {
    Q1: "Какой товар или услуга вас интересует?",
    Q2: "Для каких целей вам это нужно?",
    Q3: "Какой у вас бюджет?",
    summary: "Спасибо! На основе ваших ответов, я подготовлю персональное предложение.",
    completed: "Ваша заявка обработана. Менеджер свяжется с вами в ближайшее время."
  },
  kz: {
    Q1: "Сізді қандай тауар немесе қызмет қызықтырады?",
    Q2: "Бұл сізге не үшін керек?",
    Q3: "Сіздің бюджетіңіз қандай?",
    summary: "Рақмет! Сіздің жауаптарыңыз негізінде жеке ұсыныс дайындаймын.",
    completed: "Сіздің өтінішіңіз өңделді. Менеджер жақын арада сізбен байланысады."
  },
  en: {
    Q1: "What product or service are you interested in?",
    Q2: "What do you need it for?",
    Q3: "What is your budget?",
    summary: "Thank you! Based on your answers, I'll prepare a personalized offer.",
    completed: "Your request has been processed. A manager will contact you soon."
  }
};

export class SalesFunnel {
  private states: Map<string, FunnelState> = new Map();
  private pool: Pool;
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  // Generate unique key for state storage
  private getKey(userId: string, platform: string): string {
    return `${platform}_${userId}`;
  }
  
  // Initialize funnel for user
  initFunnel(userId: string, platform: string, businessId: string, language: 'kz' | 'ru' | 'en' = 'ru'): FunnelState {
    const key = this.getKey(userId, platform);
    const state: FunnelState = {
      userId,
      platform,
      businessId,
      language,
      currentStep: 'Q1',
      answers: {},
      startTime: new Date()
    };
    
    this.states.set(key, state);
    return state;
  }
  
  // Get current state
  getState(userId: string, platform: string): FunnelState | undefined {
    return this.states.get(this.getKey(userId, platform));
  }
  
  // Get current question for user
  getCurrentQuestion(userId: string, platform: string): string | null {
    const state = this.getState(userId, platform);
    if (!state) return null;
    
    const questions = FUNNEL_QUESTIONS[state.language];
    return questions[state.currentStep] || null;
  }
  
  // Process user answer and move to next step
  async processAnswer(userId: string, platform: string, answer: string): Promise<{ 
    nextQuestion?: string; 
    isComplete: boolean;
    summary?: string;
  }> {
    const state = this.getState(userId, platform);
    if (!state) {
      return { isComplete: false };
    }
    
    const questions = FUNNEL_QUESTIONS[state.language];
    
    // Save answer based on current step
    switch (state.currentStep) {
      case 'Q1':
        state.answers.q1 = answer;
        state.currentStep = 'Q2';
        break;
      case 'Q2':
        state.answers.q2 = answer;
        state.currentStep = 'Q3';
        break;
      case 'Q3':
        state.answers.q3 = answer;
        state.currentStep = 'summary';
        
        // Save lead to database
        await this.saveLead(state);
        
        return {
          isComplete: false,
          summary: this.generateSummary(state)
        };
      case 'summary':
        state.currentStep = 'completed';
        return {
          nextQuestion: questions.completed,
          isComplete: true
        };
      default:
        return { isComplete: true };
    }
    
    // Update state
    this.states.set(this.getKey(userId, platform), state);
    
    return {
      nextQuestion: questions[state.currentStep],
      isComplete: false
    };
  }
  
  // Generate summary of answers
  private generateSummary(state: FunnelState): string {
    const questions = FUNNEL_QUESTIONS[state.language];
    
    let summary = questions.summary + '\n\n';
    
    if (state.language === 'ru') {
      summary += `📋 Ваши ответы:\n`;
      summary += `• Интересует: ${state.answers.q1}\n`;
      summary += `• Цель: ${state.answers.q2}\n`;
      summary += `• Бюджет: ${state.answers.q3}\n`;
    } else if (state.language === 'kz') {
      summary += `📋 Сіздің жауаптарыңыз:\n`;
      summary += `• Қызықтырады: ${state.answers.q1}\n`;
      summary += `• Мақсаты: ${state.answers.q2}\n`;
      summary += `• Бюджет: ${state.answers.q3}\n`;
    } else {
      summary += `📋 Your answers:\n`;
      summary += `• Interested in: ${state.answers.q1}\n`;
      summary += `• Purpose: ${state.answers.q2}\n`;
      summary += `• Budget: ${state.answers.q3}\n`;
    }
    
    return summary;
  }
  
  // Save lead to database
  private async saveLead(state: FunnelState): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO leads (
          business_id, 
          user_id, 
          platform, 
          language,
          product_interest, 
          purpose, 
          budget,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          state.businessId,
          state.userId,
          state.platform,
          state.language,
          state.answers.q1,
          state.answers.q2,
          state.answers.q3,
          new Date()
        ]
      );
    } catch (error) {
      console.error('Error saving lead:', error);
    }
  }
  
  // Check if user is in funnel
  isInFunnel(userId: string, platform: string): boolean {
    const state = this.getState(userId, platform);
    return state !== undefined && state.currentStep !== 'completed';
  }
  
  // Reset funnel for user
  resetFunnel(userId: string, platform: string): void {
    this.states.delete(this.getKey(userId, platform));
  }
  
  // Clean up old states (run periodically)
  cleanupOldStates(hoursOld: number = 24): void {
    const now = new Date();
    const maxAge = hoursOld * 60 * 60 * 1000;
    
    for (const [key, state] of this.states.entries()) {
      if (now.getTime() - state.startTime.getTime() > maxAge) {
        this.states.delete(key);
      }
    }
  }
}

export default SalesFunnel;