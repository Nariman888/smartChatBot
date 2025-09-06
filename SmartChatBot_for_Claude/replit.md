# AI Business Chat

## Overview

This is a multi-channel AI-powered chatbot platform designed to serve different types of businesses. The application provides customizable chat interfaces for various business types (dental clinics, restaurants, auto services, etc.) with support for multiple messaging platforms including Telegram and WhatsApp. It features a React-based admin panel for bot configuration and management, integrated with OpenAI's GPT models for intelligent responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Material-UI (MUI) for consistent, professional interface components
- **Animation**: Framer Motion for smooth animations and transitions
- **Routing**: React Router DOM for single-page application navigation
- **State Management**: React hooks (useState, useEffect) for local component state

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety across the entire stack
- **Development**: tsx for TypeScript execution and hot reloading
- **API Design**: RESTful endpoints for bot configuration and message handling
- **Middleware**: CORS for cross-origin requests, body-parser for request parsing

### Data Storage Solutions
- **Database**: PostgreSQL with connection pooling via pg library
- **Schema**: Structured tables for bot configurations, business settings, and conversation history
- **Connection Management**: Database connection pooling for optimal performance

### Authentication and Authorization
- **Current State**: No authentication system implemented
- **Bot Security**: Token-based authentication for external messaging platforms (Telegram, WhatsApp)

### AI Integration
- **Provider**: OpenAI GPT models for natural language processing
- **Model**: Configurable AI models (default: GPT-4o, fallback: GPT-3.5-turbo)
- **Context Management**: Conversation history tracking with sliding window approach
- **Customization**: Business-specific system prompts and response templates

### Messaging Platform Integration
- **Telegram**: Node Telegram Bot API for bot creation and message handling
- **WhatsApp Dual Support**: 
  - Twilio integration for WhatsApp Business API (legacy support)
  - WhatsApp Cloud API (Meta) for direct integration
- **Web Interface**: Built-in React chat interface for direct website integration
- **Multi-channel Support**: Unified message processing across all platforms
- **WhatsApp Cloud Features**:
  - Webhook verification with custom tokens
  - Message read receipts and typing indicators
  - Automatic retry logic for rate limiting
  - Zod validation for webhook security

### Development and Deployment
- **Development Server**: Vite dev server with HMR on port 5000
- **Production Build**: TypeScript compilation followed by Vite bundling
- **Code Quality**: ESLint with TypeScript-specific rules and React hooks linting
- **Environment Configuration**: dotenv for environment variable management

## External Dependencies

### Core AI Services
- **OpenAI API**: Primary AI service for generating intelligent responses
- **API Key Management**: Environment-based configuration for secure API access

### Messaging Platforms
- **Telegram Bot API**: For Telegram bot functionality and webhook handling
- **Twilio**: WhatsApp Business API integration (legacy support)
- **WhatsApp Cloud API (Meta)**: Direct WhatsApp integration via Graph API
- **Platform Tokens**: Secure token storage for each messaging platform
- **Webhook Security**: Zod validation for incoming webhook payloads

### Database Services
- **PostgreSQL**: Primary database for persistent data storage
- **Connection String**: Environment-configured database connection

### Development Tools
- **Node.js Ecosystem**: Runtime environment and package management
- **TypeScript Compiler**: Type checking and JavaScript transpilation
- **ESLint**: Code linting and style enforcement

### UI and Styling
- **Material-UI**: Component library and theming system
- **Emotion**: CSS-in-JS styling solution (MUI dependency)
- **Lucide React**: Icon library for consistent iconography

### Utilities
- **UUID**: Unique identifier generation for messages and sessions
- **Axios**: HTTP client for API requests
- **React Markdown**: Markdown rendering for rich text responses
- **Zod**: Runtime type validation for webhook payloads and API requests