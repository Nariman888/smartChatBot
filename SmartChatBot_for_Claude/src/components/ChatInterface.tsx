import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Typography, 
  Card, 
  CardContent,
  IconButton,
  Avatar,
  Chip
} from '@mui/material';
import { Send, SmartToy, Person, SupportAgent } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, BusinessType } from '../types';
import { aiService } from '../services/aiService';
import { v4 as uuidv4 } from 'uuid';

interface ChatInterfaceProps {
  businessType: BusinessType;
  customPrompt?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ businessType, customPrompt }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Приветственное сообщение
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      content: aiService.generateSampleResponse(businessType),
      sender: 'bot',
      timestamp: new Date(),
      businessType: businessType.id
    };
    setMessages([welcomeMessage]);
  }, [businessType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Проверяем, нужна ли эскалация
    const escalationKeywords = ['менеджер', 'жалоба', 'директор', 'руководство', 'сотрудник', 'проблема'];
    const needsEscalation = aiService.checkEscalationNeeded(inputMessage, escalationKeywords);

    if (needsEscalation && !isEscalated) {
      setIsEscalated(true);
      const escalationMessage: ChatMessage = {
        id: uuidv4(),
        content: 'Понимаю, что вопрос требует особого внимания. Сейчас соединю вас с нашим специалистом для персональной консультации.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, escalationMessage]);
      setIsLoading(false);
      return;
    }

    try {
      const allMessages = [...messages, userMessage];
      const botResponse = await aiService.generateResponse(allMessages, businessType, customPrompt);

      const botMessage: ChatMessage = {
        id: uuidv4(),
        content: botResponse,
        sender: 'bot',
        timestamp: new Date(),
        businessType: businessType.id
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        content: 'Извините, произошла ошибка. Попробуйте еще раз.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSampleQuestion = (question: string) => {
    setInputMessage(question);
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.paper',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      {/* Заголовок */}
      <Box sx={{ 
        p: 2, 
        bgcolor: businessType.color, 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <Typography variant="h4">{businessType.icon}</Typography>
        <Box>
          <Typography variant="h6">{businessType.name}</Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {businessType.description}
          </Typography>
        </Box>
        {isEscalated && (
          <Chip
            icon={<SupportAgent />}
            label="Связь со специалистом"
            color="secondary"
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      {/* Примеры вопросов */}
      {messages.length === 1 && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Попробуйте задать один из этих вопросов:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {businessType.sampleQuestions.map((question, index) => (
              <Chip
                key={index}
                label={question}
                variant="outlined"
                clickable
                size="small"
                onClick={() => handleSampleQuestion(question)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Сообщения */}
      <Box sx={{ 
        flex: 1, 
        p: 2, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1
                }}
              >
                <Card
                  sx={{
                    maxWidth: '70%',
                    bgcolor: message.sender === 'user' 
                      ? 'primary.main' 
                      : 'grey.100',
                    color: message.sender === 'user' ? 'white' : 'text.primary'
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar sx={{ 
                        width: 24, 
                        height: 24, 
                        bgcolor: message.sender === 'user' ? 'rgba(255,255,255,0.2)' : businessType.color
                      }}>
                        {message.sender === 'user' ? <Person sx={{ fontSize: 16 }} /> : <SmartToy sx={{ fontSize: 16 }} />}
                      </Avatar>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      {message.content}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Card sx={{ bgcolor: 'grey.100' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: businessType.color }}>
                      <SmartToy sx={{ fontSize: 16 }} />
                    </Avatar>
                    <Typography variant="body2">Печатает...</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Поле ввода */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isEscalated ? "Ожидайте ответа специалиста..." : "Напишите ваше сообщение..."}
            disabled={isEscalated || isLoading}
            variant="outlined"
            size="small"
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isEscalated || isLoading}
            sx={{ alignSelf: 'flex-end' }}
          >
            <Send />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInterface;