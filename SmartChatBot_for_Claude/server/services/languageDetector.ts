// Language detection service for KAZ/RUS
import { Translate } from '@google-cloud/translate/build/src/v2';

interface LanguageResult {
  language: 'kz' | 'ru' | 'en';
  confidence: number;
}

// Keywords for language detection
const KAZAKH_KEYWORDS = [
  'сәлем', 'сәлеметсіз бе', 'қалайсыз', 'рақмет', 'жақсы', 
  'кешіріңіз', 'мен', 'сіз', 'біз', 'олар', 'бұл', 'ол',
  'қанша', 'қашан', 'қайда', 'неге', 'қалай', 'не'
];

const RUSSIAN_KEYWORDS = [
  'привет', 'здравствуйте', 'спасибо', 'пожалуйста', 'как дела',
  'извините', 'я', 'вы', 'мы', 'они', 'это', 'он', 'она',
  'сколько', 'когда', 'где', 'почему', 'как', 'что'
];

export class LanguageDetector {
  private googleTranslate?: Translate;
  
  constructor(apiKey?: string) {
    if (apiKey) {
      this.googleTranslate = new Translate({ key: apiKey });
    }
  }
  
  // Simple keyword-based detection
  private detectByKeywords(text: string): LanguageResult {
    const lowerText = text.toLowerCase();
    
    let kazScore = 0;
    let rusScore = 0;
    
    // Check for Kazakh keywords
    for (const keyword of KAZAKH_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        kazScore++;
      }
    }
    
    // Check for Russian keywords
    for (const keyword of RUSSIAN_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        rusScore++;
      }
    }
    
    // Check for Cyrillic specific to Kazakh
    const kazSpecific = /[әіңғүұқөһ]/i;
    if (kazSpecific.test(text)) {
      kazScore += 3;
    }
    
    if (kazScore > rusScore) {
      return {
        language: 'kz',
        confidence: kazScore / (kazScore + rusScore) || 0.5
      };
    } else if (rusScore > 0) {
      return {
        language: 'ru',
        confidence: rusScore / (kazScore + rusScore) || 0.5
      };
    }
    
    // Default to Russian if Cyrillic detected
    if (/[а-яА-Я]/.test(text)) {
      return { language: 'ru', confidence: 0.5 };
    }
    
    return { language: 'en', confidence: 0.3 };
  }
  
  // Use Google Translate API for more accurate detection
  async detectWithGoogle(text: string): Promise<LanguageResult> {
    if (!this.googleTranslate) {
      return this.detectByKeywords(text);
    }
    
    try {
      const [detections] = await this.googleTranslate.detect(text);
      const detection = Array.isArray(detections) ? detections[0] : detections;
      
      let language: 'kz' | 'ru' | 'en' = 'ru';
      if (detection.language === 'kk') {
        language = 'kz';
      } else if (detection.language === 'ru') {
        language = 'ru';
      } else if (detection.language === 'en') {
        language = 'en';
      }
      
      return {
        language,
        confidence: detection.confidence || 0.8
      };
    } catch (error) {
      console.log('Google Translate error, falling back to keywords:', error);
      return this.detectByKeywords(text);
    }
  }
  
  // Main detection method
  async detect(text: string): Promise<LanguageResult> {
    // First try keyword detection for quick response
    const keywordResult = this.detectByKeywords(text);
    
    // If high confidence, return immediately
    if (keywordResult.confidence > 0.7) {
      return keywordResult;
    }
    
    // Otherwise, try Google API for better accuracy
    if (this.googleTranslate) {
      return this.detectWithGoogle(text);
    }
    
    return keywordResult;
  }
}

export default LanguageDetector;