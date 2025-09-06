const isDevelopment = import.meta.env.DEV;
const isReplit = window.location.hostname.includes('replit');

let API_BASE_URL = 'http://localhost:3001';

if (isReplit) {
  // В Replit используем относительный путь для прокси через Vite
  API_BASE_URL = '/api-backend';
} else if (!isDevelopment) {
  // В продакшене используем тот же домен
  API_BASE_URL = window.location.origin.replace(':5000', ':3001');
}

export { API_BASE_URL };