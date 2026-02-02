import { useEffect, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { ACARSMessage, WebSocketMessage, ADSBBatchMessage, HFGCSAircraftMessage, EAMDetectedMessage } from '../types';

export interface WebSocketMessageHandlers {
  onADSBBatch?: (messages: ACARSMessage[]) => void;
  onACARSMessage?: (message: ACARSMessage) => void;
  onHFGCSAircraft?: (event: string, aircraft: any) => void;
  onEAMDetected?: (eam: any) => void;
  onSkykingDetected?: (skyking: any) => void;
  onEAMRepeat?: (repeat: any) => void;
  onATCTranscription?: (data: any) => void;
  onATCRecording?: (data: any) => void;
  onEmergencyTranscription?: (data: any) => void;
  onYoutubeStreamError?: (data: any) => void;
  onConnection?: (data: any) => void;
  onConflictDetected?: (conflict: any) => void;
  onConflictResolved?: (conflict: any) => void;
  onConflictUpdated?: (conflict: any) => void;
}

export interface UseWebSocketMessagesOptions {
  url?: string;
  shouldConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  handlers: WebSocketMessageHandlers;
}

/**
 * Custom hook to handle WebSocket messages with typed handlers
 * Replaces direct useWebSocket usage with a more structured approach
 */
export function useWebSocketMessages(options: UseWebSocketMessagesOptions) {
  const {
    url = `ws://${window.location.hostname}:3000/ws`,
    shouldConnect = true,
    reconnectAttempts = 10,
    reconnectInterval = 3000,
    handlers
  } = options;

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    url,
    {
      shouldReconnect: () => true,
      reconnectAttempts,
      reconnectInterval,
    },
    shouldConnect
  );

  // Process incoming WebSocket messages
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const wsData: WebSocketMessage = JSON.parse(lastMessage.data);

        switch (wsData.type) {
          case 'adsb_batch':
            // ADS-B batch message
            if (handlers.onADSBBatch) {
              const batchData = wsData as ADSBBatchMessage;
              handlers.onADSBBatch(batchData.data);
            }
            break;

          case 'acars':
            // Individual ACARS message
            if (handlers.onACARSMessage) {
              handlers.onACARSMessage(wsData.data as ACARSMessage);
            }
            break;

          case 'hfgcs_aircraft':
            // HFGCS aircraft event
            if (handlers.onHFGCSAircraft) {
              const hfgcsData = wsData as HFGCSAircraftMessage;
              handlers.onHFGCSAircraft(hfgcsData.data.event, hfgcsData.data.aircraft);
            }
            break;

          case 'eam_detected':
            // EAM detected
            if (handlers.onEAMDetected) {
              const eamData = wsData as EAMDetectedMessage;
              handlers.onEAMDetected(eamData.data);
            }
            break;

          case 'skyking_detected':
            // SKYKING detected
            if (handlers.onSkykingDetected) {
              handlers.onSkykingDetected(wsData.data);
            }
            break;

          case 'eam_repeat_detected':
            // EAM repeat detected
            if (handlers.onEAMRepeat) {
              handlers.onEAMRepeat(wsData.data);
            }
            break;

          case 'atc_transcription':
            // ATC transcription
            if (handlers.onATCTranscription) {
              handlers.onATCTranscription(wsData.data);
            }
            break;

          case 'atc_recording':
            // ATC recording/VOX segment
            if (handlers.onATCRecording) {
              handlers.onATCRecording(wsData.data);
            }
            break;

          case 'emergency_transcription':
            // Emergency scanner transcription
            if (handlers.onEmergencyTranscription) {
              handlers.onEmergencyTranscription(wsData.data);
            }
            break;

          case 'youtube_stream_error':
            // YouTube stream error
            if (handlers.onYoutubeStreamError) {
              handlers.onYoutubeStreamError(wsData.data);
            }
            break;

          case 'connection':
            // Connection/welcome message
            if (handlers.onConnection) {
              handlers.onConnection(wsData.data);
            }
            break;

          case 'conflict_detected':
            // Conflict detected
            if (handlers.onConflictDetected) {
              handlers.onConflictDetected(wsData.data);
            }
            break;

          case 'conflict_resolved':
            // Conflict resolved
            if (handlers.onConflictResolved) {
              handlers.onConflictResolved(wsData.data);
            }
            break;

          case 'conflict_updated':
            // Conflict updated
            if (handlers.onConflictUpdated) {
              handlers.onConflictUpdated(wsData.data);
            }
            break;

          default:
            console.warn('Unknown WebSocket message type:', wsData.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, handlers]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Connected',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Disconnected',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  return {
    sendMessage,
    readyState,
    connectionStatus,
    isConnected: readyState === ReadyState.OPEN,
  };
}


