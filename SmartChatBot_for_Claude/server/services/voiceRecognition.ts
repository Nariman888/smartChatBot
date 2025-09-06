// Voice Recognition Service using OpenAI Whisper
import OpenAI from 'openai';
import fs from 'fs';
import https from 'https';

export class VoiceRecognitionService {
  private openai: OpenAI | null;
  
  constructor(apiKey?: string) {
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }
  
  // Download voice message from Telegram
  async downloadTelegramVoice(fileUrl: string, token: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const url = `https://api.telegram.org/file/bot${token}/${fileUrl}`;
      
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
    });
  }
  
  // Transcribe audio using OpenAI Whisper
  async transcribeAudio(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!this.openai) {
      console.error('OpenAI not configured for voice recognition');
      return '';
    }
    
    try {
      // Save buffer to temporary file
      const tempPath = `/tmp/voice_${Date.now()}.ogg`;
      fs.writeFileSync(tempPath, audioBuffer);
      
      // Transcribe with Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: language || 'ru', // Default to Russian
        prompt: 'Расшифруйте это голосовое сообщение на казахском или русском языке'
      });
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      
      return transcription.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return '';
    }
  }
  
  // Process voice message from Telegram
  async processTelegramVoice(fileId: string, token: string, language?: string): Promise<string> {
    try {
      // Get file path from Telegram
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
      );
      const fileData = await fileResponse.json();
      
      if (!fileData.ok || !fileData.result?.file_path) {
        throw new Error('Failed to get file path');
      }
      
      // Download voice file
      const audioBuffer = await this.downloadTelegramVoice(fileData.result.file_path, token);
      
      // Transcribe
      return await this.transcribeAudio(audioBuffer, language);
    } catch (error) {
      console.error('Error processing Telegram voice:', error);
      return '';
    }
  }
}

export default VoiceRecognitionService;