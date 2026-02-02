const { spawn } = require('child_process');
const EventEmitter = require('events');
const VADRecorder = require('./vad-recorder');
const AudioCapture = require('./audio-capture');

/**
 * Service for handling YouTube livestream audio extraction and processing
 * Uses yt-dlp to extract audio from YouTube livestreams and pipes to existing audio services
 */
class YouTubeStreamService extends EventEmitter {
  constructor(whisperClient, database, eamDetector = null, eamPreprocessor = null, eamAggregator = null) {
    super();
    this.whisperClient = whisperClient;
    this.database = database;
    this.eamDetector = eamDetector;
    this.eamPreprocessor = eamPreprocessor;
    this.eamAggregator = eamAggregator;
    this.activeStreams = new Map();
    this.vadRecorder = null;
    this.audioCapture = null;
  }

  /**
   * Start YouTube stream monitoring with VOX recording
   * @param {string} youtubeUrl - YouTube livestream URL
   * @param {string} feedId - Feed identifier for database
   * @param {Object} options - Options (useVOX, etc.)
   */
  async startStream(youtubeUrl, feedId, options = {}) {
    if (this.activeStreams.has(feedId)) {
      console.log(`📺 Already streaming ${feedId}`);
      return { success: false, message: 'Stream already active' };
    }

    console.log(`🎥 Starting YouTube stream: ${feedId}`);
    console.log(`📍 URL: ${youtubeUrl}`);

    const useVOX = options.useVOX !== undefined ? options.useVOX : true;

    const stream = {
      feedId,
      youtubeUrl,
      isActive: true,
      ytdlpProcess: null,
      useVOX,
      startTime: Date.now(),
      retryCount: 0,
      maxRetries: 5
    };

    this.activeStreams.set(feedId, stream);

    try {
      // Initialize VAD recorder if using VOX mode
      if (useVOX) {
        if (!this.vadRecorder) {
          this.vadRecorder = new VADRecorder(this.whisperClient, this.database, this.eamDetector, this.eamPreprocessor, this.eamAggregator);
          
          // Forward transcription events
          this.vadRecorder.on('transcription', (data) => {
            this.emit('transcription', data);
          });
        }
      } else {
        if (!this.audioCapture) {
          this.audioCapture = new AudioCapture(this.whisperClient, this.database);
          
          // Forward transcription events
          this.audioCapture.on('transcription', (data) => {
            this.emit('transcription', data);
          });
        }
      }

      // Start the yt-dlp process
      await this.spawnYtDlp(stream);

      console.log(`✅ YouTube stream started: ${feedId} (VOX: ${useVOX})`);
      return { success: true, feedId, useVOX };

    } catch (error) {
      console.error(`❌ Error starting YouTube stream ${feedId}:`, error.message);
      this.activeStreams.delete(feedId);
      throw error;
    }
  }

  /**
   * Spawn yt-dlp process and pipe to audio service
   */
  async spawnYtDlp(stream) {
    return new Promise((resolve, reject) => {
      // yt-dlp arguments for extracting best audio and outputting to stdout
      const args = [
        stream.youtubeUrl,
        '-f', 'bestaudio/best',           // Best audio quality
        '-o', '-',                         // Output to stdout
        '--quiet',                         // Suppress output
        '--no-warnings',                   // No warnings
        '--no-playlist'                    // Don't download playlists
      ];

      console.log(`🚀 Spawning yt-dlp: ${args.join(' ')}`);

      // Spawn yt-dlp process
      const ytdlp = spawn('yt-dlp', args);
      stream.ytdlpProcess = ytdlp;

      let hasStarted = false;

      // Setup audio stream BEFORE any data arrives
      const { PassThrough } = require('stream');
      const audioStream = new PassThrough();

      // Start VAD recording immediately
      const startRecording = async () => {
        try {
          if (stream.useVOX) {
            await this.startVADRecording(stream.feedId, audioStream);
          } else {
            await this.startAudioCapture(stream.feedId, audioStream);
          }
          console.log(`✅ Audio processing ready for ${stream.feedId}`);
        } catch (err) {
          console.error(`❌ Failed to start audio processing:`, err);
          reject(err);
        }
      };

      startRecording();

      // Handle stdout - this is the audio stream
      ytdlp.stdout.on('data', (chunk) => {
        if (!hasStarted) {
          hasStarted = true;
          console.log(`📻 Audio stream started for ${stream.feedId}, streaming to VAD recorder`);
          resolve();
        }
        // Write chunks to the audio stream
        audioStream.write(chunk);
      });

      // Handle stderr - log errors and warnings
      ytdlp.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.log(`yt-dlp [${stream.feedId}]: ${message}`);
        }
      });

      // Handle process errors
      ytdlp.on('error', (error) => {
        console.error(`❌ yt-dlp process error for ${stream.feedId}:`, error.message);
        this.handleStreamError(stream, error);
        reject(error);
      });

      // Handle process exit
      ytdlp.on('close', (code) => {
        console.log(`📴 yt-dlp process closed for ${stream.feedId} (code: ${code})`);
        
        // End the audio stream
        audioStream.end();
        
        if (code !== 0 && stream.isActive) {
          // Attempt retry if not manually stopped
          this.handleStreamError(stream, new Error(`Process exited with code ${code}`));
        }
        
        this.cleanupStream(stream.feedId);
      });

      // Timeout if stream doesn't start within 30 seconds
      setTimeout(() => {
        if (!hasStarted) {
          reject(new Error('Stream failed to start within 30 seconds'));
          this.stopStream(stream.feedId);
        }
      }, 30000);
    });
  }

  /**
   * Start VAD recording with custom audio stream
   */
  async startVADRecording(feedId, audioStream) {
    console.log(`🎧🎧🎧 START VAD RECORDING CALLED FOR ${feedId} 🎧🎧🎧`);
    const { PassThrough } = require('stream');
    const ffmpeg = require('fluent-ffmpeg');
    const { spawn } = require('child_process');

    console.log(`🎧 Setting up VAD recording for ${feedId}...`);
    console.log(`   Audio stream type:`, audioStream.constructor.name);

    // Build FFmpeg command for HF radio enhancement manually
    const filters = [
      'highpass=f=200',
      'lowpass=f=4000',
      'afftdn=nf=-30',
      'acompressor=threshold=0.1:ratio=8:attack=0.05:release=0.3',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'agate=threshold=0.0005:ratio=3:attack=0.01:release=0.2',
      'highshelf=f=1000:g=2'
    ];

    const outputStream = new PassThrough();

    console.log(`🎬 Starting manual FFmpeg process for ${feedId}...`);

    // Manually spawn ffmpeg for better control
    const ffmpegArgs = [
      '-analyzeduration', '2000000',
      '-probesize', '10000000',
      '-fflags', '+genpts',
      '-i', 'pipe:0',  // Read from stdin
      '-map', '0:a:0',
      '-vn',
      '-af', filters.join(','),
      '-ac', '1',
      '-ar', '16000',
      '-acodec', 'pcm_s16le',
      '-f', 'wav',
      'pipe:1'  // Write to stdout
    ];

    console.log(`🚀 Spawning FFmpeg VAD process with args:`, ffmpegArgs.slice(0, 10).join(' '));
    const ffmpegProc = spawn('ffmpeg', ffmpegArgs);
    
    console.log(`✅ FFmpeg VAD process spawned, PID: ${ffmpegProc.pid}`);
    
    // Pipe audioStream to ffmpeg stdin
    audioStream.pipe(ffmpegProc.stdin);
    console.log(`🔗 Piped audioStream to ffmpeg stdin`);
    
    // Pipe ffmpeg stdout to outputStream
    ffmpegProc.stdout.pipe(outputStream);
    console.log(`🔗 Piped ffmpeg stdout to outputStream`);
    
    ffmpegProc.stderr.on('data', (data) => {
      const msg = data.toString();
      console.log(`FFmpeg VAD stderr [${feedId}]:`, msg.trim());
    });
    
    ffmpegProc.on('error', (err) => {
      console.error(`❌❌❌ FFmpeg VAD spawn error for ${feedId}:`, err.message);
    });
    
    ffmpegProc.on('exit', (code, signal) => {
      console.log(`📴📴📴 FFmpeg VAD exited for ${feedId}, code: ${code}, signal: ${signal}`);
    });
    
    const ffmpegProcess = {
      kill: () => ffmpegProc.kill(),
      _process: ffmpegProc
    };

    // Create a recorder instance for this stream
    const rec = {
      feedId,
      isActive: true,
      ffmpegProcess,
      currentSegment: null,
      segmentCount: 0,
      channel: 'mono'
    };

    this.vadRecorder.activeRecorders.set(feedId, rec);

    let chunkCount = 0;
    let hasReceivedData = false;
    
    // Process VAD chunks
    outputStream.on('data', (chunk) => {
      if (!hasReceivedData) {
        hasReceivedData = true;
        console.log(`🎧 VAD audio stream receiving data for ${feedId}`);
      }
      chunkCount++;
      if (chunkCount % 100 === 0) {
        console.log(`🔊 Processing chunk #${chunkCount} for ${feedId}, size: ${chunk.length} bytes`);
      }
      this.vadRecorder.processVADChunk(feedId, chunk, rec);
    });

    outputStream.on('end', () => {
      console.log(`📴 Output stream ended for ${feedId}, total chunks: ${chunkCount}`);
    });
    
    outputStream.on('error', (err) => {
      console.error(`❌ Output stream error for ${feedId}:`, err.message);
    });

    console.log(`✅ VAD recording setup complete for ${feedId}`);
  }

  /**
   * Start audio capture with custom stream (HF-optimized)
   */
  async startAudioCapture(feedId, audioStream) {
    const { PassThrough } = require('stream');
    const ffmpeg = require('fluent-ffmpeg');

    console.log(`🎧 Setting up HF-optimized audio capture for ${feedId}...`);

    // Same HF-optimized filters as VAD recording
    let filters = [
      'highpass=f=200:order=8',     // HF radio has lower frequency range, steep rolloff
      'lowpass=f=4000:order=8',     // Wider range for HF, steep rolloff  
      'afftdn=nf=-30',               // Stronger noise reduction for HF atmospheric static
      'acompressor=threshold=0.1:ratio=8:attack=0.05:release=0.3',  // More aggressive for weak HF
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'agate=threshold=0.0005:ratio=3:attack=0.01:release=0.2',  // Much lower threshold for weak HF
      'highshelf=f=1000:g=2'        // HF pre-emphasis compensation
    ];

    const outputStream = new PassThrough();

    const ffmpegProcess = ffmpeg(audioStream)
      .inputOptions([
        '-analyzeduration', '2000000',
        '-probesize', '10000000',
        '-fflags', '+genpts'
      ])
      .outputOptions([
        '-map', '0:a:0',  // Map only the first audio stream
        '-vn'             // No video
      ])
      .audioFilters(filters.join(','))
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('start', (cmd) => {
        console.log(`🎬 HF Audio capture started for ${feedId}:`, cmd);
      })
      .on('error', (err) => {
        console.error(`❌ HF Audio capture error for ${feedId}:`, err.message);
      })
      .on('end', () => {
        console.log(`📴 HF Audio capture ended for ${feedId}`);
      });

    ffmpegProcess.pipe(outputStream, { end: true });

    // Process audio chunks for transcription
    let chunkCount = 0;
    outputStream.on('data', (chunk) => {
      chunkCount++;
      if (chunkCount % 100 === 0) {
        console.log(`🔊 HF Audio chunk #${chunkCount} for ${feedId}, size: ${chunk.length} bytes`);
      }
      // Forward to audio capture service
      if (this.audioCapture) {
        this.audioCapture.processAudioChunk(feedId, chunk);
      }
    });

    console.log(`✅ HF-optimized audio capture setup complete for ${feedId}`);
  }

  /**
   * Handle stream errors with retry logic
   */
  handleStreamError(stream, error) {
    console.error(`⚠️  Stream error for ${stream.feedId}:`, error.message);

    if (stream.retryCount < stream.maxRetries && stream.isActive) {
      stream.retryCount++;
      const retryDelay = Math.min(5000 * stream.retryCount, 30000); // Exponential backoff, max 30s
      
      console.log(`🔄 Retrying stream ${stream.feedId} in ${retryDelay/1000}s (attempt ${stream.retryCount}/${stream.maxRetries})`);
      
      setTimeout(() => {
        if (stream.isActive) {
          this.spawnYtDlp(stream).catch(err => {
            console.error(`❌ Retry failed for ${stream.feedId}:`, err.message);
          });
        }
      }, retryDelay);
    } else {
      console.error(`❌ Max retries reached for ${stream.feedId}, giving up`);
      this.emit('stream_failed', { feedId: stream.feedId, error });
      this.stopStream(stream.feedId);
    }
  }

  /**
   * Stop YouTube stream
   */
  stopStream(feedId) {
    const stream = this.activeStreams.get(feedId);
    if (!stream) {
      return false;
    }

    console.log(`🛑 Stopping YouTube stream: ${feedId}`);

    stream.isActive = false;

    // Kill yt-dlp process
    if (stream.ytdlpProcess) {
      try {
        stream.ytdlpProcess.kill('SIGTERM');
        setTimeout(() => {
          if (stream.ytdlpProcess) {
            stream.ytdlpProcess.kill('SIGKILL');
          }
        }, 5000);
      } catch (err) {
        console.error(`Error killing yt-dlp process:`, err.message);
      }
    }

    // Stop VAD recorder or audio capture
    if (stream.useVOX && this.vadRecorder) {
      this.vadRecorder.stopRecording(feedId);
    } else if (!stream.useVOX && this.audioCapture) {
      this.audioCapture.stopCapture(feedId);
    }

    this.cleanupStream(feedId);
    return true;
  }

  /**
   * Clean up stream resources
   */
  cleanupStream(feedId) {
    this.activeStreams.delete(feedId);
    console.log(`🧹 Cleaned up stream: ${feedId}`);
  }

  /**
   * Stop all active streams
   */
  stopAll() {
    console.log(`🛑 Stopping all YouTube streams...`);
    for (const feedId of this.activeStreams.keys()) {
      this.stopStream(feedId);
    }
  }

  /**
   * Get active streams status
   */
  getActiveStreams() {
    const streams = [];
    for (const [feedId, stream] of this.activeStreams.entries()) {
      streams.push({
        feedId,
        youtubeUrl: stream.youtubeUrl,
        isActive: stream.isActive,
        useVOX: stream.useVOX,
        uptime: Date.now() - stream.startTime,
        retryCount: stream.retryCount
      });
    }
    return streams;
  }
}

module.exports = YouTubeStreamService;

