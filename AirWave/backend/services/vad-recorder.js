const axios = require('axios');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const ContextEnhancer = require('./context-enhancer');
const AudioEnhancer = require('./audio-enhancer');

/**
 * VOX-based audio recorder with Voice Activity Detection
 * Records only when speech is detected, stores clips, then transcribes
 */
class VADRecorder extends EventEmitter {
  constructor(whisperClient, database, eamDetector = null, eamPreprocessor = null, eamAggregator = null) {
    super();
    this.whisperClient = whisperClient;
    this.database = database;
    this.eamDetector = eamDetector;
    this.eamPreprocessor = eamPreprocessor;
    this.eamAggregator = eamAggregator;
    this.contextEnhancer = new ContextEnhancer(database);
    this.audioEnhancer = new AudioEnhancer();
    this.activeRecorders = new Map();
    this.sampleRate = 16000;
    this.storageDir = path.join(__dirname, '../data/atc-recordings');
    
    // Create storage directory
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    // VAD settings
    this.vadThreshold = 0.5; // Speech probability threshold
    this.minSpeechDuration = 1000; // Min 1 second of speech
    this.minSilenceDuration = 500; // 500ms silence to end segment
    this.maxSpeechDuration = 30000; // Max 30 seconds per segment
  }

  /**
   * Start recording with VAD for an ATC feed
   */
  async startRecording(feedId, streamUrl, options = {}) {
    if (this.activeRecorders.has(feedId)) {
      console.log(`📻 Already recording ${feedId}`);
      return { success: false, message: 'Already recording' };
    }

    console.log(`🎙️  Starting VAD recording for ${feedId}`);
    
    const recorder = {
      feedId,
      streamUrl,
      isActive: true,
      ffmpegProcess: null,
      currentSegment: null,
      segmentCount: 0,
      channel: options.channel || 'mono'
    };

    this.activeRecorders.set(feedId, recorder);

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

      // Build FFmpeg command for VAD processing
      let ffmpegCmd = ffmpeg(audioStream)
        .inputFormat('mp3');

      // Build filter chain for VHF AM radio enhancement
      let filters = [];

      // Extract specific channel if needed
      if (options.channel === 'left') {
        filters.push('pan=mono|c0=c0');
      } else if (options.channel === 'right') {
        filters.push('pan=mono|c0=c1');
      }

      // Add VHF AM radio optimizations
      // These filters are specifically tuned for aviation radio frequencies
      filters.push('highpass=f=300');        // Remove low-frequency rumble
      filters.push('lowpass=f=3000');        // Remove high-frequency noise
      filters.push('afftdn=nf=-20');         // FFT-based noise reduction for radio static
      filters.push('acompressor=threshold=0.125:ratio=6:attack=0.1:release=0.2'); // Even out volume
      filters.push('loudnorm=I=-16:TP=-1.5:LRA=11'); // Normalize for optimal Whisper levels
      filters.push('agate=threshold=0.002:ratio=2:attack=0.01:release=0.1'); // Remove quiet noise

      // Apply all filters
      if (filters.length > 0) {
        ffmpegCmd = ffmpegCmd.audioFilters(filters.join(','));
      }

      // Convert to 16kHz mono WAV for Whisper
      recorder.ffmpegProcess = ffmpegCmd
        .audioFrequency(this.sampleRate)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('error', (err) => {
          console.error(`❌ FFmpeg error for ${feedId}:`, err.message);
          this.stopRecording(feedId);
        })
        .on('end', () => {
          console.log(`📴 Stream ended for ${feedId}`);
          this.stopRecording(feedId);
        });

      // Create a simple VAD using amplitude detection
      // (This is a simplified version - we can enhance with Silero-VAD later)
      const outputStream = new PassThrough();
      recorder.ffmpegProcess.pipe(outputStream);

      let buffer = [];
      let isSpeaking = false;
      let silenceStart = null;
      let speechStart = null;

      outputStream.on('data', (chunk) => {
        this.processVADChunk(feedId, chunk, recorder);
      });

      const channelInfo = options.channel ? ` (${options.channel} channel)` : '';
      console.log(`✅ VAD recording started for ${feedId}${channelInfo}`);
      return { success: true, feedId };

    } catch (error) {
      console.error(`❌ Error recording ${feedId}:`, error.message);
      this.activeRecorders.delete(feedId);
      throw error;
    }
  }

  /**
   * Process audio chunks with simple amplitude-based VAD
   */
  processVADChunk(feedId, chunk, recorder) {
    const rec = recorder || this.activeRecorders.get(feedId);
    if (!rec || !rec.isActive) return;

    // Simple amplitude-based speech detection
    const amplitude = this.calculateAmplitude(chunk);
    const isSpeech = amplitude > 300; // Lower threshold for HF/YouTube streams
    
    // Debug logging every 50 chunks
    if (!rec.debugCount) rec.debugCount = 0;
    rec.debugCount++;
    if (rec.debugCount % 50 === 0) {
      console.log(`🔊 ${feedId}: amplitude=${amplitude.toFixed(0)}, isSpeech=${isSpeech}, segment=${!!rec.currentSegment}`);
    }

    if (!rec.currentSegment && isSpeech) {
      // Start new speech segment
      rec.currentSegment = {
        feedId,
        startTime: Date.now(),
        buffer: [],
        segmentId: `${feedId}_${Date.now()}`
      };
      console.log(`🗣️  Speech detected on ${feedId} (amplitude: ${amplitude.toFixed(0)})`);
    }

    if (rec.currentSegment) {
      rec.currentSegment.buffer.push(chunk);
      
      const duration = Date.now() - rec.currentSegment.startTime;
      
      // End segment if: silence detected OR max duration reached
      if (!isSpeech && rec.currentSegment.buffer.length > 20) {
        // Check if we have enough silence
        const silenceDuration = 500; // Simplified
        setTimeout(() => this.finalizeSegment(feedId), silenceDuration);
      } else if (duration > this.maxSpeechDuration) {
        this.finalizeSegment(feedId);
      }
    }
  }

  /**
   * Calculate audio amplitude for VAD
   */
  calculateAmplitude(chunk) {
    if (chunk.length < 2) return 0;
    
    let sum = 0;
    for (let i = 0; i < chunk.length - 1; i += 2) {
      const sample = chunk.readInt16LE(i);
      sum += Math.abs(sample);
    }
    return sum / (chunk.length / 2);
  }

  /**
   * Finalize and save speech segment
   */
  async finalizeSegment(feedId) {
    const rec = this.activeRecorders.get(feedId);
    if (!rec || !rec.currentSegment) return;

    const segment = rec.currentSegment;
    const duration = Date.now() - segment.startTime;

    // Ignore very short segments (< 1 second)
    if (duration < this.minSpeechDuration) {
      rec.currentSegment = null;
      return;
    }

    console.log(`💾 Saving speech segment: ${segment.segmentId} (${(duration/1000).toFixed(1)}s)`);

    try {
      // Save audio file
      const audioBuffer = Buffer.concat(segment.buffer);
      const filename = `${segment.segmentId}.wav`;
      const filepath = path.join(this.storageDir, filename);
      
      // Add WAV header
      const wavBuffer = this.createWAVFile(audioBuffer);
      fs.writeFileSync(filepath, wavBuffer);

      // Save metadata to database
      if (this.database) {
        this.database.saveATCRecording({
          segmentId: segment.segmentId,
          feedId: segment.feedId,
          startTime: new Date(segment.startTime).toISOString(),
          duration: duration,
          filename: filename,
          filepath: filepath,
          filesize: wavBuffer.length,
          transcribed: false
        });
      }

      rec.segmentCount++;
      rec.currentSegment = null;

      // Queue for transcription
      this.queueTranscription(segment.segmentId, filepath);

    } catch (error) {
      console.error(`❌ Error saving segment:`, error.message);
      rec.currentSegment = null;
    }
  }

  /**
   * Create WAV file with proper header
   */
  createWAVFile(audioData) {
    const header = Buffer.alloc(44);
    
    // "RIFF" chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + audioData.length, 4);
    header.write('WAVE', 8);
    
    // "fmt " sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk size
    header.writeUInt16LE(1, 20);  // Audio format (PCM)
    header.writeUInt16LE(1, 22);  // Num channels
    header.writeUInt32LE(this.sampleRate, 24); // Sample rate
    header.writeUInt32LE(this.sampleRate * 2, 28); // Byte rate
    header.writeUInt16LE(2, 32);  // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    
    // "data" sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(audioData.length, 40);
    
    return Buffer.concat([header, audioData]);
  }

  /**
   * Check if transcription is non-speech (music, noise, applause, etc.)
   */
  isNonSpeech(text) {
    const lowerText = text.toLowerCase();
    
    // Common non-speech indicators from Whisper
    const nonSpeechPatterns = [
      /^\*.*\*$/,                    // Anything in asterisks (e.g., *Piano music*)
      /^\[.*\]$/,                    // Anything in brackets (e.g., [Music])
      /\(music\)/i,
      /\(applause\)/i,
      /music playing/i,
      /background music/i,
      /piano music/i,
      /applauds/i,
      /applause/i,
      /applaudissements/i,
      /clapping/i,
      /^\s*$/,                       // Empty or whitespace only
      /^thank you\.?$/i,             // Just "thank you" (common false positive)
      /^you$/i,                      // Just "you" (common false positive)
      /^\.+$/,                       // Just dots/periods
      /^\*+$/,                       // Just asterisks
    ];

    return nonSpeechPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Queue segment for transcription
   */
  async queueTranscription(segmentId, filepath) {
    try {
      console.log(`🔄 Transcribing segment: ${segmentId}`);
      
      // Read audio file
      const audioBuffer = fs.readFileSync(filepath);
      
      // Transcribe
      const transcription = await this.whisperClient.transcribe(audioBuffer, {
        language: 'en'
      });

      if (transcription && transcription.text && transcription.text.trim()) {
        const text = transcription.text.trim();
        
        // Check if this is non-speech (music, noise, applause, etc.)
        if (this.isNonSpeech(text)) {
          console.log(`🗑️  Discarding non-speech segment: ${segmentId} - "${text}"`);
          
          // Delete the audio file
          try {
            fs.unlinkSync(filepath);
          } catch (err) {
            console.error(`⚠️  Could not delete file: ${filepath}`);
          }
          
          // Delete from database
          if (this.database) {
            this.database.deleteRecording(segmentId);
          }
          
          return; // Don't process or emit this segment
        }
        
        const feedId = segmentId.split('_')[0] + '_' + segmentId.split('_')[1];
        
        // Enhance with context (speaker identification, callsigns, etc.)
        const enhanced = await this.contextEnhancer.enhanceTranscription(
          { text, segments: transcription.segments || [] },
          feedId
        );

        // Add speaker labels if identified
        let displayText = text;
        if (enhanced.context && enhanced.context.speakerHints) {
          displayText = this.contextEnhancer.addSpeakerLabels(text, enhanced.context.speakerHints);
        }

        console.log(`📝 [${segmentId}] ${text}`);
        if (enhanced.context?.identifiedCallsigns?.length > 0) {
          console.log(`   ✈️  Callsigns: ${enhanced.context.identifiedCallsigns.join(', ')}`);
        }
        
        // Update database
        if (this.database) {
          this.database.updateRecordingTranscription(segmentId, {
            text: displayText,
            segments: transcription.segments || [],
            transcribedAt: new Date().toISOString()
          });
        }

        // Detect EAMs if detector is available and this is HFGCS feed
        if (this.eamDetector && feedId.includes('hfgcs')) {
          try {
            const eamResult = await this.eamDetector.detectEAM(
              text,
              segmentId,
              feedId
            );
            
            if (eamResult && eamResult.detected) {
              const segmentInfo = eamResult.multi_segment ? ` across ${eamResult.segment_count} segments` : '';
              console.log(`🚨 EAM DETECTED: ${eamResult.type} - Confidence: ${eamResult.confidence_score}%${segmentInfo}`);
              
              // Save or update EAM in database
              await this.eamDetector.deduplicateMessage(eamResult);
            }
          } catch (error) {
            console.error('Error detecting EAM:', error.message);
            // Don't fail transcription if EAM detection fails
          }
        }

        // Emit for real-time display
        this.emit('transcription', {
          segmentId,
          feedId,
          text: displayText,
          originalText: text,
          timestamp: new Date().toISOString(),
          audioFile: path.basename(filepath),
          context: enhanced.context || null
        });
      }
    } catch (error) {
      console.error(`❌ Transcription error for ${segmentId}:`, error.message);
    }
  }

  /**
   * Stop recording a feed
   */
  stopRecording(feedId) {
    const rec = this.activeRecorders.get(feedId);
    if (!rec) return false;

    console.log(`🛑 Stopping recording for ${feedId}`);
    
    // Finalize any current segment
    if (rec.currentSegment) {
      this.finalizeSegment(feedId);
    }

    rec.isActive = false;
    
    // Kill FFmpeg process
    if (rec.ffmpegProcess) {
      try {
        rec.ffmpegProcess.kill('SIGKILL');
      } catch (err) {
        // Ignore
      }
    }

    this.activeRecorders.delete(feedId);
    console.log(`📊 Recorded ${rec.segmentCount} speech segments`);
    return true;
  }

  /**
   * Stop all recordings
   */
  stopAll() {
    console.log(`🛑 Stopping all recordings...`);
    for (const feedId of this.activeRecorders.keys()) {
      this.stopRecording(feedId);
    }
  }

  /**
   * Get active recordings status
   */
  getActiveRecordings() {
    const recordings = [];
    for (const [feedId, rec] of this.activeRecorders.entries()) {
      recordings.push({
        feedId,
        isActive: rec.isActive,
        segmentCount: rec.segmentCount,
        channel: rec.channel
      });
    }
    return recordings;
  }

  /**
   * Clean up old recordings
   */
  cleanupOldRecordings(daysToKeep = 7) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(this.storageDir);
      let deletedCount = 0;

      files.forEach(file => {
        const filepath = path.join(this.storageDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      });

      console.log(`🗑️  Cleaned up ${deletedCount} old recording files`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning recordings:', error);
      return 0;
    }
  }
}

module.exports = VADRecorder;

