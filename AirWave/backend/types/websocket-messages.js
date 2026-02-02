/**
 * WebSocket Message Type Definitions
 * 
 * This module defines all WebSocket message types used for real-time communication
 * between the backend and frontend.
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {string} type - Message type
 * @property {*} data - Message payload
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} ConnectionMessage
 * @property {'connection'} type
 * @property {Object} data
 * @property {string} data.status - Connection status
 * @property {string} timestamp
 */

/**
 * @typedef {Object} ACARSMessage
 * @property {'acars'} type
 * @property {Object} data - ACARS message object
 * @property {string} timestamp
 */

/**
 * @typedef {Object} ADSBMessage
 * @property {'adsb'} type
 * @property {Object} data - ADS-B message object
 * @property {string} timestamp
 */

/**
 * @typedef {Object} ADSBBatchMessage
 * @property {'adsb_batch'} type
 * @property {number} count - Number of messages in batch
 * @property {Object[]} data - Array of ADS-B message objects
 * @property {string} timestamp
 */

/**
 * @typedef {Object} HFGCSAircraftMessage
 * @property {'hfgcs_aircraft'} type
 * @property {Object} data
 * @property {string} data.event - Event type: 'detected' | 'updated' | 'lost'
 * @property {Object} data.aircraft - Aircraft data
 * @property {string} timestamp
 */

/**
 * @typedef {Object} EAMDetectedMessage
 * @property {'eam_detected'} type
 * @property {Object} data - EAM message object
 * @property {string} timestamp
 */

/**
 * @typedef {Object} SkykingDetectedMessage
 * @property {'skyking_detected'} type
 * @property {Object} data - Skyking message object
 * @property {string} timestamp
 */

/**
 * @typedef {Object} EAMRepeatDetectedMessage
 * @property {'eam_repeat_detected'} type
 * @property {Object} data
 * @property {Object} data.original - Original EAM message
 * @property {Object} data.repeat - Repeat EAM message
 * @property {string} timestamp
 */

/**
 * @typedef {Object} TranscriptionCompleteMessage
 * @property {'transcription_complete'} type
 * @property {Object} data
 * @property {string} data.segmentId - Recording segment ID
 * @property {string} data.text - Transcribed text
 * @property {Object} data.metadata - Transcription metadata
 * @property {string} timestamp
 */

/**
 * @typedef {Object} RecordingStartedMessage
 * @property {'recording_started'} type
 * @property {Object} data
 * @property {string} data.segmentId - Recording segment ID
 * @property {string} data.streamUrl - Stream URL
 * @property {string} timestamp
 */

/**
 * @typedef {Object} RecordingStoppedMessage
 * @property {'recording_stopped'} type
 * @property {Object} data
 * @property {string} data.segmentId - Recording segment ID
 * @property {number} data.duration - Recording duration in seconds
 * @property {string} timestamp
 */

/**
 * Message type constants
 */
const MESSAGE_TYPES = {
  CONNECTION: 'connection',
  ACARS: 'acars',
  ADSB: 'adsb',
  ADSB_BATCH: 'adsb_batch',
  HFGCS_AIRCRAFT: 'hfgcs_aircraft',
  EAM_DETECTED: 'eam_detected',
  SKYKING_DETECTED: 'skyking_detected',
  EAM_REPEAT_DETECTED: 'eam_repeat_detected',
  TRANSCRIPTION_COMPLETE: 'transcription_complete',
  RECORDING_STARTED: 'recording_started',
  RECORDING_STOPPED: 'recording_stopped'
};

/**
 * Create a WebSocket message
 * @param {string} type - Message type
 * @param {*} data - Message data
 * @returns {WebSocketMessage} Formatted WebSocket message
 */
function createMessage(type, data) {
  return {
    type,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a connection message
 * @param {string} status - Connection status
 * @returns {ConnectionMessage}
 */
function createConnectionMessage(status = 'connected') {
  return createMessage(MESSAGE_TYPES.CONNECTION, { status });
}

/**
 * Create an ACARS message
 * @param {Object} message - ACARS message object
 * @returns {ACARSMessage}
 */
function createACARSMessage(message) {
  return createMessage(MESSAGE_TYPES.ACARS, message);
}

/**
 * Create an ADS-B batch message
 * @param {Object[]} messages - Array of ADS-B messages
 * @returns {ADSBBatchMessage}
 */
function createADSBBatchMessage(messages) {
  return {
    type: MESSAGE_TYPES.ADSB_BATCH,
    count: messages.length,
    data: messages,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create an HFGCS aircraft message
 * @param {string} event - Event type
 * @param {Object} aircraft - Aircraft data
 * @returns {HFGCSAircraftMessage}
 */
function createHFGCSAircraftMessage(event, aircraft) {
  return createMessage(MESSAGE_TYPES.HFGCS_AIRCRAFT, { event, aircraft });
}

/**
 * Create an EAM detected message
 * @param {Object} eam - EAM message object
 * @returns {EAMDetectedMessage}
 */
function createEAMDetectedMessage(eam) {
  return createMessage(MESSAGE_TYPES.EAM_DETECTED, eam);
}

/**
 * Create a Skyking detected message
 * @param {Object} skyking - Skyking message object
 * @returns {SkykingDetectedMessage}
 */
function createSkykingDetectedMessage(skyking) {
  return createMessage(MESSAGE_TYPES.SKYKING_DETECTED, skyking);
}

/**
 * Create a transcription complete message
 * @param {string} segmentId - Recording segment ID
 * @param {string} text - Transcribed text
 * @param {Object} metadata - Transcription metadata
 * @returns {TranscriptionCompleteMessage}
 */
function createTranscriptionCompleteMessage(segmentId, text, metadata = {}) {
  return createMessage(MESSAGE_TYPES.TRANSCRIPTION_COMPLETE, {
    segmentId,
    text,
    metadata
  });
}

/**
 * Create a recording started message
 * @param {string} segmentId - Recording segment ID
 * @param {string} streamUrl - Stream URL
 * @returns {RecordingStartedMessage}
 */
function createRecordingStartedMessage(segmentId, streamUrl) {
  return createMessage(MESSAGE_TYPES.RECORDING_STARTED, {
    segmentId,
    streamUrl
  });
}

/**
 * Create a recording stopped message
 * @param {string} segmentId - Recording segment ID
 * @param {number} duration - Recording duration in seconds
 * @returns {RecordingStoppedMessage}
 */
function createRecordingStoppedMessage(segmentId, duration) {
  return createMessage(MESSAGE_TYPES.RECORDING_STOPPED, {
    segmentId,
    duration
  });
}

module.exports = {
  MESSAGE_TYPES,
  createMessage,
  createConnectionMessage,
  createACARSMessage,
  createADSBBatchMessage,
  createHFGCSAircraftMessage,
  createEAMDetectedMessage,
  createSkykingDetectedMessage,
  createTranscriptionCompleteMessage,
  createRecordingStartedMessage,
  createRecordingStoppedMessage
};

