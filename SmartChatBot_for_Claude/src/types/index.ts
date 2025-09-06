export interface BusinessType {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  systemPrompt: string;
  sampleQuestions: string[];
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  businessType?: string;
}

export interface BotConfig {
  id: string;
  businessType: BusinessType;
  customPrompt?: string;
  isActive: boolean;
  escalationKeywords: string[];
  createdAt: Date;
}

export interface ConversationSession {
  id: string;
  messages: ChatMessage[];
  businessType: string;
  isEscalated: boolean;
  startedAt: Date;
  endedAt?: Date;
}