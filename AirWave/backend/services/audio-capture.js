const axios = require('axios');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const EventEmitter = require('events');

/**
 * Captures and processes live ATC audio streams
 */
class AudioCapture extends EventEmitter {
  constructor(whisperClient, database) {
    super();
    this.whisperClient = whisperClient;
    this.database = database;
    this.activeCaptures = new Map();
    this.chunkDuration = 10; // 10 seconds chunks
    this.sampleRate = 16000; // 16kHz for Whisper
  }

  /**
   * Start capturing and transcribing an ATC feed
   * @param {string} feedId - Feed identifier
   * @param {string} streamUrl - Audio stream URL
   * @param {Object} options - Capture options (splitStereo, etc.)
   */
  async startCapture(feedId, streamUrl, options = {}) {
    const splitStereo = options.splitStereo || false;

    if (splitStereo) {
      // Start two separate captures for left and right channels
      return this.startStereoCapture(feedId, streamUrl);
    }

    if (this.activeCaptures.has(feedId)) {
      console.log(`📻 Already capturing ${feedId}`);
      return { success: false, message: 'Already capturing' };
    }

    console.log(`🎙️  Starting audio capture for ${feedId}`);
    
    const capture = {
      feedId,
      streamUrl,
      buffer: [],
      bufferStart: Date.now(),
      isActive: true,
      ffmpegProcess: null,
      channel: options.channel || 'mono'
    };

    this.activeCaptures.set(feedId, capture);

    try {
      // Stream audio from source
      const response = await axios({
        method: 'get',
        url: streamUrl,
        responseType: 'stream',
        timeout: 10000
      });

      const audioStream = new PassThrough();
      response.data.pipe(audioStream);

      // Build FFmpeg command
      let ffmpegCmd = ffmpeg(audioStream)
        .inputFormat('mp3'); // LiveATC streams are typically MP3

      // If specific channel requested, extract it
      if (options.channel === 'left') {
        ffmpegCmd = ffmpegCmd.audioFilters('pan=mono|c0=c0'); // Extract left channel
      } else if (options.channel === 'right') {
        ffmpegCmd = ffmpegCmd.audioFilters('pan=mono|c0=c1'); // Extract right channel
      } else {
        // Mono or auto-mix stereo to mono
        ffmpegCmd = ffmpegCmd.audioChannels(1);
      }

      // Convert to 16kHz mono WAV for Whisper
      capture.ffmpegProcess = ffmpegCmd
        .audioFrequency(this.sampleRate)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('error', (err) => {
          console.error(`❌ FFmpeg error for ${feedId}:`, err.message);
          this.stopCapture(feedId);
        })
        .on('end', () => {
          console.log(`📴 Stream ended for ${feedId}`);
          this.stopCapture(feedId);
        });

      // Pipe to buffer collector
      const outputStream = new PassThrough();
      capture.ffmpegProcess.pipe(outputStream);

      outputStream.on('data', (chunk) => {
        this.handleAudioChunk(feedId, chunk);
      });

      const channelInfo = options.channel ? ` (${options.channel} channel)` : '';
      console.log(`✅ Capture started for ${feedId}${channelInfo}`);
      return { success: true, feedId };

    } catch (error) {
      console.error(`❌ Error capturing ${feedId}:`, error.message);
      this.activeCaptures.delete(feedId);
      throw error;
    }
  }

  /**
   * Start stereo capture - splits into left and right channels
   */
  async startStereoCapture(feedId, streamUrl) {
    console.log(`🎧 Starting stereo capture for ${feedId} (L+R channels)`);
    
    try {
      // Start left channel
      const leftFeedId = `${feedId}_L`;
      await this.startCapture(leftFeedId, streamUrl, { channel: 'left' });
      
      // Start right channel
      const rightFeedId = `${feedId}_R`;
      await this.startCapture(rightFeedId, streamUrl, { channel: 'right' });
      
      console.log(`✅ Stereo capture started: ${leftFeedId} + ${rightFeedId}`);
      return { 
        success: true, 
        feedId, 
        channels: [leftFeedId, rightFeedId] 
      };
    } catch (error) {
      console.error(`❌ Error starting stereo capture:`, error.message);
      throw error;
    }
  }

  /**
   * Handle incoming audio chunks
   */
  handleAudioChunk(feedId, chunk) {
    const capture = this.activeCaptures.get(feedId);
    if (!capture || !capture.isActive) return;

    capture.buffer.push(chunk);

    // Calculate buffer size (16kHz * 2 bytes per sample * duration in seconds)
    const totalSize = capture.buffer.reduce((sum, buf) => sum + buf.length, 0);
    const targetSize = this.sampleRate * 2 * this.chunkDuration;

    // Process when we have enough data
    if (totalSize >= targetSize) {
      this.processBuffer(feedId);
    }
  }

  /**
   * Process accumulated audio buffer through Whisper
   */
  async processBuffer(feedId) {
    const capture = this.activeCaptures.get(feedId);
    if (!capture || capture.buffer.length === 0) return;

    const audioBuffer = Buffer.concat(capture.buffer);
    capture.buffer = []; // Clear buffer
    capture.bufferStart = Date.now();

    try {
      console.log(`🔄 Transcribing ${audioBuffer.length} bytes for ${feedId}...`);
      
      const transcription = await this.whisperClient.transcribe(audioBuffer, {
        language: 'en'
      });

      if (transcription && transcription.text && transcription.text.trim()) {
        const text = transcription.text.trim();
        console.log(`📝 [${feedId}] ${text}`);
        
        // Save to database
        if (this.database) {
          this.database.saveTranscription({
            feedId,
            text,
            timestamp: new Date().toISOString(),
            segments: transcription.segments || []
          });
        }

        // Emit for WebSocket broadcast
        this.emit('transcription', {
          feedId,
          text,
          timestamp: new Date().toISOString(),
          segments: transcription.segments || []
        });
      }
    } catch (error) {
      console.error(`❌ Transcription error for ${feedId}:`, error.message);
      // Continue capturing even if transcription fails
    }
  }

  /**
   * Stop capturing a feed
   */
  stopCapture(feedId) {
    const capture = this.activeCaptures.get(feedId);
    if (!capture) return false;

    console.log(`🛑 Stopping capture for ${feedId}`);
    
    capture.isActive = false;
    
    // Kill FFmpeg process
    if (capture.ffmpegProcess) {
      try {
        capture.ffmpegProcess.kill('SIGKILL');
      } catch (err) {
        // Ignore errors when killing process
      }
    }

    this.activeCaptures.delete(feedId);
    return true;
  }

  /**
   * Stop all captures
   */
  stopAll() {
    console.log(`🛑 Stopping all captures...`);
    for (const feedId of this.activeCaptures.keys()) {
      this.stopCapture(feedId);
    }
  }

  /**
   * Get status of active captures
   */
  getActiveCaptures() {
    const captures = [];
    for (const [feedId, capture] of this.activeCaptures.entries()) {
      captures.push({
        feedId,
        isActive: capture.isActive,
        bufferSize: capture.buffer.length
      });
    }
    return captures;
  }
}

module.exports = AudioCapture;

