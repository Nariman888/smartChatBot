import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { 
  Save, 
 
  Delete,
  SmartToy,
  Phone,
  Message
} from '@mui/icons-material';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { businessTypes } from '../data/businessTypes';
import type { BusinessType } from '../types';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

interface BotConfig {
  business_id: string;
  business_name: string;
  business_type: string;
  system_prompt: string;
  ai_model?: string;
  telegram_enabled: boolean;
  whatsapp_enabled: boolean;
  telegram_token?: string;
  whatsapp_number?: string;
  created_at?: string;
  updated_at?: string;
}

const MessengerBotAdmin: React.FC = () => {
  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [businessId, setBusinessId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [testDialog, setTestDialog] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/configs`);
      setConfigs(response.data);
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  const handleBusinessTypeSelect = (type: BusinessType) => {
    setSelectedType(type);
    setSystemPrompt(type.systemPrompt);
    setBusinessName(type.name);
  };

  const handleSave = async () => {
    if (!businessId || !businessName || !selectedType) {
      setAlert({ type: 'error', message: 'Заполните все обязательные поля' });
      return;
    }

    setLoading(true);
    try {
      const data = {
        businessId,
        businessName,
        businessType: selectedType.id,
        systemPrompt,
        aiModel,
        telegramEnabled,
        whatsappEnabled,
        telegramToken,
        whatsappNumber
      };

      await axios.post(`${API_URL}/api/configs`, data);
      setAlert({ type: 'success', message: 'Конфигурация успешно сохранена!' });
      fetchConfigs();
      resetForm();
    } catch (error) {
      setAlert({ type: 'error', message: 'Ошибка при сохранении конфигурации' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить эту конфигурацию?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/configs/${id}`);
      fetchConfigs();
      setAlert({ type: 'success', message: 'Конфигурация удалена' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Ошибка при удалении' });
    }
  };

  const handleTest = async () => {
    if (!businessId || !testMessage) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/test-message`, {
        businessId,
        message: testMessage
      });
      setTestResponse(response.data.response);
    } catch (error) {
      setTestResponse('Ошибка при тестировании');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBusinessId('');
    setBusinessName('');
    setSystemPrompt('');
    setAiModel('gpt-4o');
    setSelectedType(null);
    setTelegramEnabled(false);
    setWhatsappEnabled(false);
    setTelegramToken('');
    setWhatsappNumber('');
  };

  const editConfig = (config: BotConfig) => {
    const type = businessTypes.find(t => t.id === config.business_type);
    if (type) {
      setSelectedType(type);
      setBusinessId(config.business_id);
      setBusinessName(config.business_name);
      setSystemPrompt(config.system_prompt);
      setAiModel(config.ai_model || 'gpt-4o');
      setTelegramEnabled(config.telegram_enabled);
      setWhatsappEnabled(config.whatsapp_enabled);
      setTelegramToken(config.telegram_token || '');
      setWhatsappNumber(config.whatsapp_number || '');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartToy /> AI Business Chat - Мессенджеры
      </Typography>

      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Существующие конфигурации */}
        <Box sx={{ width: '100%' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Настроенные боты
              </Typography>
              
              {configs.length === 0 ? (
                <Typography color="text.secondary">
                  Нет настроенных ботов. Создайте первого бота ниже.
                </Typography>
              ) : (
                <List>
                  {configs.map(config => (
                    <ListItem
                      key={config.business_id}
                      sx={{ 
                        bgcolor: 'grey.50', 
                        mb: 1, 
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200'
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6">
                              {config.business_name}
                            </Typography>
                            {config.telegram_enabled && <Message color="primary" />}
                            {config.whatsapp_enabled && <Phone color="success" />}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">ID: {config.business_id}</Typography>
                            <Typography variant="body2">Тип: {config.business_type}</Typography>
                          </Box>
                        }
                      />
                      <Box>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => editConfig(config)}
                          sx={{ mr: 1 }}
                        >
                          Изменить
                        </Button>
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(config.business_id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Выбор типа бизнеса */}
        <Box sx={{ flex: '0 0 30%', minWidth: '300px' }}>
          <Typography variant="h6" gutterBottom>
            1. Выберите сферу бизнеса
          </Typography>
          
          {businessTypes.map((type) => (
            <Card
              key={type.id}
              sx={{
                mb: 2,
                cursor: 'pointer',
                border: selectedType?.id === type.id ? 2 : 1,
                borderColor: selectedType?.id === type.id ? type.color : 'divider',
                '&:hover': { boxShadow: 3 }
              }}
              onClick={() => handleBusinessTypeSelect(type)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h4">{type.icon}</Typography>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {type.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Настройка бота */}
        <Box sx={{ flex: '1 1 70%' }}>
          {selectedType ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                2. Настройка бота: {selectedType.name}
              </Typography>

              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <TextField
                    fullWidth
                    label="ID бизнеса (уникальный)"
                    value={businessId}
                    onChange={(e) => setBusinessId(e.target.value)}
                    placeholder="my-dental-clinic"
                    helperText="Латинские буквы, цифры и дефис"
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Название компании"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Стоматология Улыбка"
                    sx={{ mb: 2 }}
                  />

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Модель ИИ</InputLabel>
                    <Select
                      value={aiModel}
                      label="Модель ИИ"
                      onChange={(e) => setAiModel(e.target.value)}
                    >
                      <MenuItem value="gpt-4o">
                        GPT-4o (Самая новая и быстрая) ⚡ Рекомендуется
                      </MenuItem>
                      <MenuItem value="gpt-4-turbo-preview">
                        GPT-4 Turbo (Мощная, подробные ответы)
                      </MenuItem>
                      <MenuItem value="gpt-4">
                        GPT-4 (Классическая версия)
                      </MenuItem>
                      <MenuItem value="gpt-3.5-turbo">
                        GPT-3.5 Turbo (Быстрая и экономичная)
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    label="Системный промпт для ИИ"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    helperText="Инструкции для поведения бота"
                  />
                </CardContent>
              </Card>

              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Мессенджеры
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={telegramEnabled}
                        onChange={(e) => setTelegramEnabled(e.target.checked)}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Message /> Telegram
                      </Box>
                    }
                  />

                  {telegramEnabled && (
                    <TextField
                      fullWidth
                      label="Telegram Bot Token"
                      type="password"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="Получите от @BotFather"
                      helperText="Создайте бота в @BotFather и вставьте токен"
                      sx={{ mt: 2, mb: 2 }}
                    />
                  )}

                  <FormControlLabel
                    control={
                      <Switch
                        checked={whatsappEnabled}
                        onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone /> WhatsApp (Twilio)
                      </Box>
                    }
                  />

                  {whatsappEnabled && (
                    <TextField
                      fullWidth
                      label="WhatsApp номер (Twilio)"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+14155238886"
                      helperText="Номер WhatsApp из Twilio"
                      sx={{ mt: 2 }}
                    />
                  )}
                </CardContent>
              </Card>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Save />}
                  onClick={handleSave}
                  disabled={loading || !businessId}
                >
                  Сохранить конфигурацию
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Message />}
                  onClick={() => setTestDialog(true)}
                  disabled={!businessId}
                >
                  Тестировать
                </Button>
              </Box>
            </Box>
          ) : (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary">
                  Выберите сферу бизнеса слева
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Диалог тестирования */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Тестирование бота</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Сообщение"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Введите тестовое сообщение..."
            sx={{ mb: 2, mt: 2 }}
          />

          {testResponse && (
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Ответ бота:
              </Typography>
              <Typography variant="body2">{testResponse}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>Закрыть</Button>
          <Button onClick={handleTest} variant="contained" disabled={loading}>
            Отправить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MessengerBotAdmin;