const WhisperClient = require('../whisper-client');
const AudioCapture = require('../audio-capture');
const VADRecorder = require('../vad-recorder');
const YouTubeStreamService = require('../youtube-stream-service');

/**
 * Initialize audio services (Whisper, audio capture, VAD recorder, YouTube streaming)
 * @param {Object} params - Parameters object
 * @param {Object} params.database - Database instance
 * @param {Object} params.eamDetector - EAM detector instance
 * @param {Object} params.configManager - Config manager instance
 * @returns {Object} Audio services object
 */
function initializeAudioServices({ database, eamDetector, configManager }) {
  console.log('🎙️  Initializing audio services...');
  
  // Initialize Whisper client
  const whisperClient = new WhisperClient();
  console.log('✅ Whisper client initialized');
  
  // Initialize audio capture service
  const audioCapture = new AudioCapture(database, whisperClient, eamDetector);
  console.log('✅ Audio capture service initialized');
  
  // Initialize VAD recorder
  const vadRecorder = new VADRecorder(database, whisperClient, eamDetector);
  console.log('✅ VAD recorder initialized');
  
  // Initialize YouTube stream service
  const youtubeStreamService = new YouTubeStreamService(database, audioCapture, vadRecorder);
  console.log('✅ YouTube stream service initialized');
  
  return { whisperClient, audioCapture, vadRecorder, youtubeStreamService };
}

/**
 * Cleanup audio services on shutdown
 * @param {Object} services - Audio services object
 */
async function cleanupAudioServices(services) {
  if (services.youtubeStreamService) {
    await services.youtubeStreamService.stopAllStreams();
  }
  if (services.audioCapture) {
    services.audioCapture.stopCapture();
  }
  if (services.vadRecorder) {
    services.vadRecorder.stopRecording();
  }
  console.log('✅ Audio services cleaned up');
}

module.exports = {
  initializeAudioServices,
  cleanupAudioServices
};

