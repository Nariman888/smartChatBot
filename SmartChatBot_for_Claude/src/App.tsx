import { useState } from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Button,
  Container,
  Paper,
  Tabs,
  Tab,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import { Chat, Settings, Analytics, SmartToy } from '@mui/icons-material';
import ChatInterface from './components/ChatInterface';
import EnhancedBotAdmin from './components/EnhancedBotAdmin';
import type { BusinessType } from './types';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
});

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedBusinessType] = useState<BusinessType | null>(null);
  const [customPrompt] = useState<string | undefined>(undefined);



  const renderContent = () => {
    switch (currentTab) {
      case 0:
        return selectedBusinessType ? (
          <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5">
                Тестирование бота: {selectedBusinessType.name}
              </Typography>
              <Button onClick={() => setCurrentTab(1)} variant="outlined">
                Вернуться к настройкам
              </Button>
            </Box>
            <Paper sx={{ flex: 1, overflow: 'hidden' }}>
              <ChatInterface 
                businessType={selectedBusinessType}
                customPrompt={customPrompt}
              />
            </Paper>
          </Box>
        ) : (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <SmartToy sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Добро пожаловать в AI Business Chat Platform
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Создайте умного чат-бота для вашего бизнеса за несколько минут
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              onClick={() => setCurrentTab(1)}
            >
              Начать настройку
            </Button>
          </Paper>
        );
      
      case 1:
        return <EnhancedBotAdmin />;
      
      case 2:
        return (
          <Paper sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom>
              📊 Аналитика (В разработке)
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Здесь будет отображаться статистика разговоров, популярные вопросы и эффективность ботов.
            </Typography>
            
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Запланированные функции:
              </Typography>
              <ul>
                <li>Статистика сообщений по дням/неделям/месяцам</li>
                <li>Топ самых популярных вопросов</li>
                <li>Время ответа и удовлетворенность клиентов</li>
                <li>Анализ эскалаций к живым операторам</li>
                <li>A/B тестирование различных промптов</li>
                <li>Экспорт данных и отчетов</li>
              </ul>
            </Box>
          </Paper>
        );
      
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <SmartToy sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              AI Business Chat Platform - Интеграция с мессенджерами
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Универсальная платформа чат-ботов для бизнеса
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
          <Container maxWidth="lg">
            <Tabs 
              value={currentTab} 
              onChange={(_, newValue) => setCurrentTab(newValue)}
              aria-label="navigation tabs"
            >
              <Tab 
                icon={<Chat />} 
                label="Чат-интерфейс" 
                iconPosition="start"
              />
              <Tab 
                icon={<Settings />} 
                label="Настройки бота" 
                iconPosition="start"
              />
              <Tab 
                icon={<Analytics />} 
                label="Аналитика" 
                iconPosition="start"
              />
            </Tabs>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 4 }}>
          {renderContent()}
        </Container>

        {/* Футер с информацией */}
        <Box sx={{ 
          mt: 6, 
          py: 3, 
          bgcolor: 'grey.100', 
          borderTop: 1, 
          borderColor: 'divider' 
        }}>
          <Container maxWidth="lg">
            <Typography variant="body2" color="text.secondary" align="center">
              🚀 AI Business Chat Platform | Создано для автоматизации клиентского сервиса
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
