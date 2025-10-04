import type GoogleIntegration from './googleIntegration';

type SupportedLanguage = 'ru' | 'kz' | 'en';

interface PlaceholderPrompt {
  raw: string;
  normalized: string;
  question: string;
}

interface WorkflowState {
  type: 'invoice' | 'proposal';
  templateId: string;
  folderId?: string;
  language: SupportedLanguage;
  businessId: string;
  questions: PlaceholderPrompt[];
  answers: Record<string, string>;
  autoValues: Record<string, string>;
  currentIndex: number;
  outputName: string;
}

interface StartWorkflowOptions {
  userId: string;
  platform: string;
  type: 'invoice' | 'proposal';
  templateId: string;
  folderId?: string;
  language: SupportedLanguage;
  businessId: string;
  businessName?: string;
  defaultValues?: Record<string, string>;
  outputName: string;
}

interface WorkflowResult {
  status: 'question' | 'completed' | 'cancelled' | 'error';
  message?: string;
  question?: string;
  pdfBuffer?: Buffer;
  fileName?: string;
  caption?: string;
  webViewLink?: string;
}

const CANCEL_KEYWORDS = ['отмена', 'cancel', 'stop', 'стоп'];

const PLACEHOLDER_QUESTIONS: Record<string, { ru: string; kz?: string; en?: string }> = {
  CLIENT_NAME: {
    ru: 'Введите имя клиента:',
    kz: 'Клиенттің атын енгізіңіз:',
    en: 'Please provide the client name:'
  },
  COMPANY_NAME: {
    ru: 'Укажите название компании клиента:',
    kz: 'Клиент компаниясының атауын көрсетіңіз:',
    en: 'Provide the client company name:'
  },
  CONTACT_EMAIL: {
    ru: 'Введите email для связи:',
    kz: 'Байланыс үшін email енгізіңіз:',
    en: 'Enter the contact email:'
  },
  CONTACT_PHONE: {
    ru: 'Укажите телефон клиента:',
    kz: 'Клиенттің телефон нөмірін көрсетіңіз:',
    en: 'Provide the client phone number:'
  },
  PROJECT_NAME: {
    ru: 'Как называется проект или объект?',
    kz: 'Жоба немесе объект қалай аталады?',
    en: 'What is the project or site name?'
  },
  DELIVERY_ADDRESS: {
    ru: 'Введите адрес доставки/выполнения работ:',
    kz: 'Жеткізу/жұмыс мекен-жайын енгізіңіз:',
    en: 'Enter the delivery or service address:'
  },
  PAYMENT_TERMS: {
    ru: 'Укажите условия оплаты:',
    kz: 'Төлем шарттарын көрсетіңіз:',
    en: 'Specify the payment terms:'
  },
  PRODUCTS_TABLE: {
    ru: 'Перечислите товары/услуги с количеством и ценой (например: "Обои, 20 рулонов, 8500₸"):',
    kz: 'Тауарлар/қызметтерді саны және бағасымен жазыңыз (мысалы: "Қабырға қағазы, 20 рулон, 8500₸"):',
    en: 'List products/services with quantity and price (e.g. "Wallpaper, 20 rolls, 8500₸"): '
  },
  TOTAL_AMOUNT: {
    ru: 'Укажите итоговую сумму к оплате:',
    kz: 'Төленетін жалпы соманы көрсетіңіз:',
    en: 'Provide the total amount payable:'
  },
  VAT_AMOUNT: {
    ru: 'Введите сумму НДС (если применимо):',
    kz: 'ҚҚС сомасын көрсетіңіз (қажет болса):',
    en: 'Enter the VAT amount (if applicable):'
  },
  MANAGER_NAME: {
    ru: 'Укажите имя менеджера, который готовит документ:',
    kz: 'Құжатты дайындаған менеджердің атын көрсетіңіз:',
    en: 'Enter the manager name preparing the document:'
  }
};

const AUTO_PLACEHOLDERS: Record<string, (options: StartWorkflowOptions) => string | undefined> = {
  DATE: () => new Date().toLocaleDateString('ru-RU'),
  CURRENT_DATE: () => new Date().toLocaleDateString('ru-RU'),
  BUSINESS_NAME: (options) => options.businessName || options.defaultValues?.BUSINESS_NAME,
  COMPANY_NAME: (options) => options.businessName || options.defaultValues?.COMPANY_NAME,
  BUSINESS_PHONE: (options) => options.defaultValues?.BUSINESS_PHONE,
  BUSINESS_EMAIL: (options) => options.defaultValues?.BUSINESS_EMAIL,
  MANAGER_NAME: (options) => options.defaultValues?.MANAGER_NAME
};

function normalizePlaceholder(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}

function getQuestionText(raw: string, language: SupportedLanguage): string {
  const normalized = normalizePlaceholder(raw);
  const template = PLACEHOLDER_QUESTIONS[normalized];

  if (template) {
    return template[language] || template.ru;
  }

  switch (language) {
    case 'kz':
      return `"${raw}" өрісінің мәнін енгізіңіз:`;
    case 'en':
      return `Provide a value for "${raw}":`;
    default:
      return `Введите значение для "${raw}":`;
  }
}

export default class DocumentWorkflowService {
  private states: Map<string, WorkflowState> = new Map();
  private googleIntegration: GoogleIntegration;

  constructor(googleIntegration: GoogleIntegration) {
    this.googleIntegration = googleIntegration;
  }

  private getKey(userId: string, platform: string): string {
    return `${platform}:${userId}`;
  }

  isCollecting(userId: string, platform: string): boolean {
    return this.states.has(this.getKey(userId, platform));
  }

  cancel(userId: string, platform: string): void {
    this.states.delete(this.getKey(userId, platform));
  }

  async startWorkflow(options: StartWorkflowOptions): Promise<WorkflowResult> {
    try {
      if (!this.googleIntegration.isInitialized()) {
        await this.googleIntegration.init();
      }

      const placeholders = await this.googleIntegration.getTemplatePlaceholders(options.templateId);
      const questions: PlaceholderPrompt[] = [];
      const autoValues: Record<string, string> = {};

      const defaultValuesNormalized: Record<string, string> = {};
      if (options.defaultValues) {
        for (const [key, value] of Object.entries(options.defaultValues)) {
          defaultValuesNormalized[normalizePlaceholder(key)] = value;
        }
      }

      for (const rawPlaceholder of placeholders) {
        const normalized = normalizePlaceholder(rawPlaceholder);

        if (AUTO_PLACEHOLDERS[normalized]) {
          const autoValue = AUTO_PLACEHOLDERS[normalized](options);
          if (autoValue) {
            autoValues[rawPlaceholder] = autoValue;
            continue;
          }
        }

        if (defaultValuesNormalized[normalized]) {
          autoValues[rawPlaceholder] = defaultValuesNormalized[normalized];
          continue;
        }

        questions.push({
          raw: rawPlaceholder,
          normalized,
          question: getQuestionText(rawPlaceholder, options.language)
        });
      }

      const state: WorkflowState = {
        type: options.type,
        templateId: options.templateId,
        folderId: options.folderId,
        language: options.language,
        businessId: options.businessId,
        questions,
        answers: {},
        autoValues,
        currentIndex: 0,
        outputName: options.outputName
      };

      this.states.set(this.getKey(options.userId, options.platform), state);

      if (questions.length === 0) {
        const complete = await this.finalizeWorkflow(options.userId, options.platform);
        return complete;
      }

      return {
        status: 'question',
        question: questions[0].question,
        message: this.getIntroMessage(options.type, options.language)
      };
    } catch (error: any) {
      console.error('Failed to start document workflow:', error);
      return {
        status: 'error',
        message: 'Не удалось подготовить шаблон Google Docs. Проверьте настройки интеграции.'
      };
    }
  }

  async processAnswer(userId: string, platform: string, answer: string): Promise<WorkflowResult | null> {
    const key = this.getKey(userId, platform);
    const state = this.states.get(key);
    if (!state) return null;

    if (CANCEL_KEYWORDS.includes(answer.trim().toLowerCase())) {
      this.states.delete(key);
      return {
        status: 'cancelled',
        message: state.language === 'kz'
          ? 'Құжат дайындау тоқтатылды.'
          : state.language === 'en'
            ? 'Document preparation has been cancelled.'
            : 'Подготовка документа отменена.'
      };
    }

    const currentQuestion = state.questions[state.currentIndex];
    if (currentQuestion) {
      state.answers[currentQuestion.raw] = answer.trim();
      state.currentIndex += 1;
    }

    if (state.currentIndex < state.questions.length) {
      const nextQuestion = state.questions[state.currentIndex];
      return {
        status: 'question',
        question: nextQuestion.question
      };
    }

    return this.finalizeWorkflow(userId, platform);
  }

  private async finalizeWorkflow(userId: string, platform: string): Promise<WorkflowResult> {
    const key = this.getKey(userId, platform);
    const state = this.states.get(key);
    if (!state) {
      return { status: 'error', message: 'Документ не найден в текущей сессии.' };
    }

    try {
      const placeholders: Record<string, string> = {};

      for (const [raw, value] of Object.entries(state.autoValues)) {
        placeholders[raw] = value;
      }

      for (const [raw, value] of Object.entries(state.answers)) {
        placeholders[raw] = value;
      }

      const generated = await this.googleIntegration.generateDocumentFromTemplate(
        state.templateId,
        placeholders,
        {
          outputName: state.outputName,
          folderId: state.folderId,
          cleanup: false
        }
      );

      this.states.delete(key);

      const caption = state.type === 'invoice'
        ? '🧾 Счет на оплату готов.'
        : '📄 Коммерческое предложение готово.';

      return {
        status: 'completed',
        caption,
        pdfBuffer: generated.pdfBuffer,
        fileName: `${state.outputName}.pdf`,
        webViewLink: generated.webViewLink
      };
    } catch (error) {
      console.error('Failed to finalize document workflow:', error);
      this.states.delete(key);

      return {
        status: 'error',
        message: 'Не удалось сформировать PDF из шаблона Google Docs.'
      };
    }
  }

  private getIntroMessage(type: 'invoice' | 'proposal', language: SupportedLanguage): string {
    const messages: Record<typeof type, Record<SupportedLanguage, string>> = {
      invoice: {
        ru: '🧾 Подготовим счет на оплату. Ответьте, пожалуйста, на несколько вопросов. Для отмены напишите "отмена".',
        kz: '🧾 Төлем шотын дайындаймыз. Бірнеше сұраққа жауап беріңіз. Болдырмау үшін "отмена" деп жазыңыз.',
        en: '🧾 Let’s prepare an invoice. Please answer a few questions. Type "cancel" to stop.'
      },
      proposal: {
        ru: '📄 Подготовим коммерческое предложение. Ответьте, пожалуйста, на несколько вопросов. Для отмены напишите "отмена".',
        kz: '📄 Коммерциялық ұсыныс дайындаймыз. Бірнеше сұраққа жауап беріңіз. Болдырмау үшін "отмена" деп жазыңыз.',
        en: '📄 Let’s prepare a commercial offer. Please answer a few questions. Type "cancel" to stop.'
      }
    };

    return messages[type][language];
  }
}
