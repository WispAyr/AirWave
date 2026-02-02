const axios = require('axios');
const FormData = require('form-data');
const EventEmitter = require('events');

/**
 * Client for whisper.cpp server
 */
class WhisperClient extends EventEmitter {
  constructor() {
    super();
    this.whisperUrl = process.env.WHISPER_SERVER_URL || 'http://localhost:8080';
    this.isAvailable = false;
    this.checkHealth();
  }

  /**
   * Check if whisper server is available
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.whisperUrl}/health`, { timeout: 2000 });
      this.isAvailable = response.status === 200;
      if (this.isAvailable) {
        console.log('✅ Whisper server is available');
      }
    } catch (error) {
      this.isAvailable = false;
      console.log('⚠️  Whisper server not available - transcription disabled');
    }
    return this.isAvailable;
  }

  /**
   * Transcribe audio buffer
   * @param {Buffer} audioBuffer - WAV audio buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioBuffer, options = {}) {
    if (!this.isAvailable) {
      await this.checkHealth();
      if (!this.isAvailable) {
        throw new Error('Whisper server not available');
      }
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // Add whisper parameters
      if (options.language) {
        formData.append('language', options.language);
      }
      formData.append('response-format', options.format || 'json');

      const response = await axios.post(
        `${this.whisperUrl}/inference`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 30000,
          maxContentLength: 50 * 1024 * 1024, // 50MB
          maxBodyLength: 50 * 1024 * 1024
        }
      );

      return response.data;
    } catch (error) {
      console.error('Whisper transcription error:', error.message);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Get server status
   */
  async getStatus() {
    try {
      const response = await axios.get(`${this.whisperUrl}/health`, { timeout: 2000 });
      return { available: true, status: response.data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }
}

module.exports = WhisperClient;

