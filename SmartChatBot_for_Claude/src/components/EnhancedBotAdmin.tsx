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
  ListItemButton,
  ListItemText,
  Tabs,
  Tab,
  Chip,
  Divider,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import { 
  Save, 
  Delete,
  Edit,
  SmartToy,
  Phone,
  Message,
  Language,
  QrCode,
  CloudUpload,
  TableChart,
  Psychology,
  AttachMoney,
  Group,
  Settings,
  Send,
  Cancel
} from '@mui/icons-material';
import { businessTypes } from '../data/businessTypes';
import type { BusinessType } from '../types';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

interface EnhancedBotConfig {
  business_id: string;
  business_name: string;
  business_type: string;
  system_prompt: string;
  ai_model?: string;
  
  // Messaging platforms
  telegram_enabled: boolean;
  whatsapp_enabled: boolean;
  telegram_token?: string;
  whatsapp_provider?: 'twilio' | '360dialog' | 'whatsapp-business';
  whatsapp_config?: {
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
    apiKey?: string;
    accessToken?: string;
    phoneNumberId?: string;
  };
  
  // WhatsApp Cloud API specific fields
  wa_mode?: 'twilio' | 'cloud';
  meta_verify_token?: string;
  meta_wa_token?: string;
  phone_number_id?: string;
  graph_version?: string;
  
  // Google integrations
  google_drive_folder_id?: string;
  google_sheets_prices_id?: string;
  google_sheets_leads_id?: string;
  
  // Payment providers
  kaspi_merchant_id?: string;
  halyk_iin?: string;
  bank_account?: string;
  
  // Manager contacts
  manager_telegram_id?: string;
  manager_whatsapp?: string;
  
  // Features
  language_detection: boolean;
  sales_funnel: boolean;
  qr_payments: boolean;
  catalog_enabled: boolean;
  
  created_at?: string;
  updated_at?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const EnhancedBotAdmin: React.FC = () => {
  const [configs, setConfigs] = useState<EnhancedBotConfig[]>([]);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Partial<EnhancedBotConfig>>({
    language_detection: true,
    sales_funnel: true,
    qr_payments: false,
    catalog_enabled: false,
    ai_model: 'gpt-4o',
    whatsapp_provider: 'twilio',
    wa_mode: 'twilio',
    graph_version: 'v23.0'
  });
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [testDialog, setTestDialog] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const handleSelectType = (type: BusinessType) => {
    setSelectedType(type);
    setCurrentConfig({
      ...currentConfig,
      business_type: type.id,
      system_prompt: type.systemPrompt
    });
  };

  const handleSave = async () => {
    if (!currentConfig.business_id || !currentConfig.business_name) {
      setAlert({ type: 'error', message: 'Заполните обязательные поля!' });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Update existing config
        await axios.put(`${API_URL}/api/configs/${editingId}`, currentConfig);
        setAlert({ type: 'success', message: 'Конфигурация обновлена успешно!' });
      } else {
        // Create new config
        await axios.post(`${API_URL}/api/configs`, currentConfig);
        setAlert({ type: 'success', message: 'Конфигурация создана успешно!' });
      }
      
      fetchConfigs();
      
      // Reset form
      setCurrentConfig({
        language_detection: true,
        sales_funnel: true,
        qr_payments: false,
        catalog_enabled: false,
        ai_model: 'gpt-4o',
        whatsapp_provider: 'twilio',
        wa_mode: 'twilio',
        graph_version: 'v23.0'
      });
      setSelectedType(null);
      setEditingId(null);
    } catch (error) {
      setAlert({ type: 'error', message: 'Ошибка при сохранении конфигурации' });
    }
    setLoading(false);
  };

  const handleEdit = (config: EnhancedBotConfig) => {
    setCurrentConfig(config);
    setEditingId(config.business_id);
    const businessType = businessTypes.find(t => t.id === config.business_type);
    if (businessType) {
      setSelectedType(businessType);
    }
    setTabValue(0); // Switch to first tab
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setCurrentConfig({
      language_detection: true,
      sales_funnel: true,
      qr_payments: false,
      catalog_enabled: false,
      ai_model: 'gpt-4o',
      whatsapp_provider: 'twilio',
      wa_mode: 'twilio',
      graph_version: 'v23.0'
    });
    setSelectedType(null);
    setEditingId(null);
  };

  const handleTest = async () => {
    if (!testMessage || !currentConfig.business_id) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/test-message`, {
        businessId: currentConfig.business_id,
        message: testMessage
      });
      setTestResponse(response.data.response);
    } catch (error) {
      setTestResponse('Ошибка при тестировании');
    }
    setLoading(false);
  };

  const handleDelete = async (businessId: string) => {
    if (window.confirm('Удалить эту конфигурацию?')) {
      try {
        await axios.delete(`${API_URL}/api/configs/${businessId}`);
        fetchConfigs();
        setAlert({ type: 'success', message: 'Конфигурация удалена' });
      } catch (error) {
        setAlert({ type: 'error', message: 'Ошибка при удалении' });
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🚀 Расширенная настройка AI ботов
      </Typography>
      
      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {editingId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Редактирование конфигурации: {editingId}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Основные настройки" icon={<Settings />} />
          <Tab label="Мессенджеры" icon={<Message />} />
          <Tab label="AI и языки" icon={<Psychology />} />
          <Tab label="Google интеграции" icon={<CloudUpload />} />
          <Tab label="Оплата" icon={<AttachMoney />} />
          <Tab label="Менеджер" icon={<Group />} />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Business Type Selection */}
        <Box sx={{ flex: '0 0 30%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Выберите тип бизнеса
              </Typography>
              <List>
                {businessTypes.map((type) => (
                  <ListItemButton
                    key={type.id}
                    selected={selectedType?.id === type.id}
                    onClick={() => handleSelectType(type)}
                    sx={{
                      bgcolor: selectedType?.id === type.id ? 'primary.light' : 'inherit',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{type.icon}</span>
                          <span>{type.name}</span>
                        </Box>
                      }
                      secondary={type.description}
                    />
                  </ListItemButton>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>

        {/* Configuration Form */}
        <Box sx={{ flex: '1 1 70%' }}>
          <Card>
            <CardContent>
              <TabPanel value={tabValue} index={0}>
                {/* Basic Settings */}
                <Typography variant="h6" gutterBottom>
                  <Settings /> Основные настройки
                </Typography>
                
                <TextField
                  fullWidth
                  label="ID бизнеса (уникальный)"
                  value={currentConfig.business_id || ''}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, business_id: e.target.value })}
                  margin="normal"
                  required
                  disabled={editingId !== null}
                  helperText="Например: my-dental-clinic"
                />
                
                <TextField
                  fullWidth
                  label="Название компании"
                  value={currentConfig.business_name || ''}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, business_name: e.target.value })}
                  margin="normal"
                  required
                />
                
                <FormControl fullWidth margin="normal">
                  <InputLabel>AI Модель</InputLabel>
                  <Select
                    value={currentConfig.ai_model || 'gpt-4o'}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, ai_model: e.target.value })}
                  >
                    <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo (быстрая)</MenuItem>
                    <MenuItem value="gpt-4">GPT-4 (умная)</MenuItem>
                    <MenuItem value="gpt-4o">GPT-4o (оптимальная)</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Системный промпт"
                  value={currentConfig.system_prompt || ''}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, system_prompt: e.target.value })}
                  margin="normal"
                  multiline
                  rows={4}
                  helperText="Инструкции для AI бота"
                />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                {/* Messenger Settings */}
                <Typography variant="h6" gutterBottom>
                  <Message /> Настройки мессенджеров
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={currentConfig.telegram_enabled || false}
                        onChange={(e) => setCurrentConfig({ ...currentConfig, telegram_enabled: e.target.checked })}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone /> Telegram Bot
                      </Box>
                    }
                  />
                  
                  {currentConfig.telegram_enabled && (
                    <TextField
                      fullWidth
                      label="Telegram Bot Token"
                      value={currentConfig.telegram_token || ''}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, telegram_token: e.target.value })}
                      margin="normal"
                      placeholder="Получите от @BotFather"
                    />
                  )}
                </Box>
                
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={currentConfig.whatsapp_enabled || false}
                        onChange={(e) => setCurrentConfig({ ...currentConfig, whatsapp_enabled: e.target.checked })}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone /> WhatsApp Business
                      </Box>
                    }
                  />
                  
                  {currentConfig.whatsapp_enabled && (
                    <>
                      <FormControl fullWidth margin="normal">
                        <InputLabel>WhatsApp Режим</InputLabel>
                        <Select
                          value={currentConfig.wa_mode || 'twilio'}
                          onChange={(e) => setCurrentConfig({ 
                            ...currentConfig, 
                            wa_mode: e.target.value as 'twilio' | 'cloud'
                          })}
                        >
                          <MenuItem value="twilio">Twilio</MenuItem>
                          <MenuItem value="cloud">WhatsApp Cloud API (Meta)</MenuItem>
                        </Select>
                      </FormControl>
                      
                      {currentConfig.wa_mode === 'twilio' && (
                        <>
                          <TextField
                            fullWidth
                            label="Twilio Account SID"
                            margin="normal"
                            value={currentConfig.whatsapp_config?.accountSid || ''}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              whatsapp_config: {
                                ...currentConfig.whatsapp_config,
                                accountSid: e.target.value
                              }
                            })}
                          />
                          <TextField
                            fullWidth
                            label="Twilio Auth Token"
                            type="password"
                            margin="normal"
                            value={currentConfig.whatsapp_config?.authToken || ''}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              whatsapp_config: {
                                ...currentConfig.whatsapp_config,
                                authToken: e.target.value
                              }
                            })}
                          />
                          <TextField
                            fullWidth
                            label="WhatsApp Number"
                            margin="normal"
                            placeholder="+14155238886"
                            value={currentConfig.whatsapp_config?.phoneNumber || ''}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              whatsapp_config: {
                                ...currentConfig.whatsapp_config,
                                phoneNumber: e.target.value
                              }
                            })}
                          />
                        </>
                      )}
                      
                      {currentConfig.wa_mode === 'cloud' && (
                        <>
                          <TextField
                            fullWidth
                            label="Meta Verify Token (для верификации вебхука)"
                            margin="normal"
                            value={currentConfig.meta_verify_token || ''}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              meta_verify_token: e.target.value
                            })}
                            helperText="Токен для верификации вебхука в Meta Business"
                          />
                          <TextField
                            fullWidth
                            label="Meta WhatsApp Access Token"
                            margin="normal"
                            type="password"
                            value={currentConfig.meta_wa_token || ''}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              meta_wa_token: e.target.value
                            })}
                            helperText="Access Token из Meta Business для отправки сообщений"
                          />
                          <TextField
                            fullWidth
                            label="Phone Number ID"
                            margin="normal"
                            value={currentConfig.phone_number_id || ''}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              phone_number_id: e.target.value
                            })}
                            helperText="ID номера телефона из Meta Business"
                          />
                          <TextField
                            fullWidth
                            label="Graph API Version"
                            margin="normal"
                            value={currentConfig.graph_version || 'v23.0'}
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              graph_version: e.target.value
                            })}
                            helperText="Версия Graph API (например: v23.0)"
                          />
                        </>
                      )}
                    </>
                  )}
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                {/* AI & Language Settings */}
                <Typography variant="h6" gutterBottom>
                  <Psychology /> AI и языковые настройки
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={currentConfig.language_detection || false}
                        onChange={(e) => setCurrentConfig({ 
                          ...currentConfig, 
                          language_detection: e.target.checked 
                        })}
                      />
                    }
                    label={
                      <Box>
                        <Typography>
                          <Language /> Автоопределение языка (KAZ/RUS)
                        </Typography>
                        <Typography variant="caption">
                          Бот будет автоматически определять язык клиента
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
                
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={currentConfig.sales_funnel || false}
                        onChange={(e) => setCurrentConfig({ 
                          ...currentConfig, 
                          sales_funnel: e.target.checked 
                        })}
                      />
                    }
                    label={
                      <Box>
                        <Typography>
                          🎯 Воронка "3 вопроса до покупки"
                        </Typography>
                        <Typography variant="caption">
                          Автоматический сбор информации о клиенте
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="body2" color="text.secondary">
                  Поддерживаемые языки:
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip label="🇰🇿 Казахский" color="primary" sx={{ mr: 1 }} />
                  <Chip label="🇷🇺 Русский" color="primary" sx={{ mr: 1 }} />
                  <Chip label="🇬🇧 English" color="default" />
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                {/* Google Integrations */}
                <Typography variant="h6" gutterBottom>
                  <CloudUpload /> Google интеграции
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentConfig.catalog_enabled || false}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        catalog_enabled: e.target.checked 
                      })}
                    />
                  }
                  label="Использовать Google Drive для каталога"
                />
                
                {currentConfig.catalog_enabled && (
                  <>
                    <TextField
                      fullWidth
                      label="Google Drive Folder ID"
                      value={currentConfig.google_drive_folder_id || ''}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        google_drive_folder_id: e.target.value 
                      })}
                      margin="normal"
                      helperText="ID папки для хранения каталога"
                    />
                    
                    <TextField
                      fullWidth
                      label="Google Sheets Prices ID"
                      value={currentConfig.google_sheets_prices_id || ''}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        google_sheets_prices_id: e.target.value 
                      })}
                      margin="normal"
                      helperText="ID таблицы с ценами"
                    />
                    
                    <TextField
                      fullWidth
                      label="Google Sheets Leads ID"
                      value={currentConfig.google_sheets_leads_id || ''}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        google_sheets_leads_id: e.target.value 
                      })}
                      margin="normal"
                      helperText="ID таблицы для сохранения лидов"
                    />
                    
                    <Button
                      variant="outlined"
                      startIcon={<TableChart />}
                      sx={{ mt: 2 }}
                      href="https://sheets.google.com"
                      target="_blank"
                    >
                      Открыть Google Sheets
                    </Button>
                  </>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                {/* Payment Settings */}
                <Typography variant="h6" gutterBottom>
                  <AttachMoney /> Настройки оплаты
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentConfig.qr_payments || false}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        qr_payments: e.target.checked 
                      })}
                    />
                  }
                  label={
                    <Box>
                      <Typography>
                        <QrCode /> QR-код оплата
                      </Typography>
                      <Typography variant="caption">
                        Kaspi Pay, Halyk Bank, универсальный QR
                      </Typography>
                    </Box>
                  }
                />
                
                {currentConfig.qr_payments && (
                  <>
                    <TextField
                      fullWidth
                      label="Kaspi Merchant ID"
                      value={currentConfig.kaspi_merchant_id || ''}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        kaspi_merchant_id: e.target.value 
                      })}
                      margin="normal"
                      helperText="Для приема платежей через Kaspi"
                    />
                    
                    <TextField
                      fullWidth
                      label="ИИН для Halyk Bank"
                      value={currentConfig.halyk_iin || ''}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        halyk_iin: e.target.value 
                      })}
                      margin="normal"
                    />
                    
                    <TextField
                      fullWidth
                      label="Банковский счет"
                      value={currentConfig.bank_account || ''}
                      onChange={(e) => setCurrentConfig({ 
                        ...currentConfig, 
                        bank_account: e.target.value 
                      })}
                      margin="normal"
                      helperText="Для формирования платежных поручений"
                    />
                  </>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={5}>
                {/* Manager Settings */}
                <Typography variant="h6" gutterBottom>
                  <Group /> Настройки менеджера
                </Typography>
                
                <TextField
                  fullWidth
                  label="Telegram ID менеджера"
                  value={currentConfig.manager_telegram_id || ''}
                  onChange={(e) => setCurrentConfig({ 
                    ...currentConfig, 
                    manager_telegram_id: e.target.value 
                  })}
                  margin="normal"
                  helperText="Для передачи горячих лидов"
                />
                
                <TextField
                  fullWidth
                  label="WhatsApp менеджера"
                  value={currentConfig.manager_whatsapp || ''}
                  onChange={(e) => setCurrentConfig({ 
                    ...currentConfig, 
                    manager_whatsapp: e.target.value 
                  })}
                  margin="normal"
                  placeholder="+7 777 123 45 67"
                />
              </TabPanel>

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                  onClick={handleSave}
                  disabled={loading}
                  fullWidth
                >
                  {editingId ? '🔄 ОБНОВИТЬ КОНФИГУРАЦИЮ' : '💾 СОХРАНИТЬ КОНФИГУРАЦИЮ'}
                </Button>
                
                {editingId && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<Cancel />}
                    onClick={handleCancelEdit}
                    fullWidth
                  >
                    ОТМЕНА
                  </Button>
                )}
                
                <Button
                  variant="outlined"
                  startIcon={<SmartToy />}
                  onClick={() => setTestDialog(true)}
                  disabled={!currentConfig.business_id}
                >
                  ТЕСТИРОВАТЬ БОТА
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Existing Configurations */}
      {configs.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Существующие конфигурации ({configs.length})
            </Typography>
            <List>
              {configs.map((config) => (
                <ListItem
                  key={config.business_id}
                  sx={{ 
                    border: 1, 
                    borderColor: 'divider', 
                    borderRadius: 1, 
                    mb: 1,
                    bgcolor: editingId === config.business_id ? 'action.selected' : 'inherit'
                  }}
                  secondaryAction={
                    <Box>
                      <IconButton
                        edge="end"
                        onClick={() => handleEdit(config)}
                        color="primary"
                        sx={{ mr: 1 }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(config.business_id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6">
                          {config.business_name}
                        </Typography>
                        <Chip 
                          label={config.business_type} 
                          size="small" 
                          color="primary" 
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2">
                          ID: {config.business_id}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          {config.telegram_enabled && (
                            <Chip 
                              label="Telegram" 
                              size="small" 
                              sx={{ mr: 1 }} 
                            />
                          )}
                          {config.whatsapp_enabled && (
                            <Chip 
                              label="WhatsApp" 
                              size="small" 
                              sx={{ mr: 1 }} 
                            />
                          )}
                          {config.language_detection && (
                            <Chip 
                              label="🌐 Language AI" 
                              size="small" 
                              sx={{ mr: 1 }} 
                            />
                          )}
                          {config.sales_funnel && (
                            <Chip 
                              label="🎯 Sales Funnel" 
                              size="small" 
                              sx={{ mr: 1 }} 
                            />
                          )}
                          {config.qr_payments && (
                            <Chip 
                              label="💳 QR Pay" 
                              size="small" 
                              sx={{ mr: 1 }} 
                            />
                          )}
                          {config.catalog_enabled && (
                            <Chip 
                              label="📂 Google Drive" 
                              size="small" 
                            />
                          )}
                        </Box>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Test Dialog */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <SmartToy /> Тестирование бота: {currentConfig.business_name}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Введите тестовое сообщение"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            margin="normal"
            multiline
            rows={2}
            placeholder="Привет! Какие у вас есть услуги?"
          />
          
          {testResponse && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Ответ бота:</Typography>
              <Typography>{testResponse}</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>Закрыть</Button>
          <Button 
            onClick={handleTest} 
            variant="contained" 
            startIcon={<Send />}
            disabled={loading}
          >
            Отправить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnhancedBotAdmin;