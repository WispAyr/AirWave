/**
 * Centralized TypeScript type definitions for AirWave frontend
 */

// ============================================================================
// Messages and Aircraft
// ============================================================================

export interface ACARSMessage {
  id: string;
  timestamp: string;
  flight?: string;
  tail?: string;
  hex?: string;
  airline?: string;
  text?: string;
  category?: string;
  label?: string;
  block_id?: string;
  msg_no?: string;
  mode?: string;
  ack?: string;
  flight_phase?: string;
  
  // Position data
  position?: AircraftPosition;
  
  // Source information
  source?: MessageSource;
  source_type?: string;
  
  // ADS-B specific fields
  squawk?: string;
  ground_speed?: number;
  velocity?: number;
  heading?: number;
  vertical_rate?: number;
  aircraft_type?: string;
  registration?: string;
  on_ground?: boolean;
  
  // Trajectory prediction
  predicted_path?: PredictedWaypoint[];
  prediction_confidence?: number;
  
  // Validation
  validation?: {
    valid: boolean;
    errors?: string[];
  };
}

export interface AircraftPosition {
  lat: number;
  lon: number;
  altitude?: number | string;
  coordinates?: string;
}

export interface MessageSource {
  type: string;
  station_id?: string;
  frequency?: number;
  api?: string;
}

export interface Aircraft {
  id: string;
  hex?: string;
  tail?: string;
  flight?: string;
  registration?: string;
  aircraft_type?: string;
  position?: AircraftPosition;
  last_seen: string;
  message_count: number;
}

// ============================================================================
// Trajectory Prediction
// ============================================================================

export interface PredictedWaypoint {
  lat: number;
  lon: number;
  altitude?: number;
  eta: string; // ISO timestamp
  confidence: number;
}

export interface TrajectoryPrediction {
  aircraft_id: string;
  predicted_path: PredictedWaypoint[];
  prediction_generated_at: string;
  prediction_confidence: number;
  horizon_minutes: number;
}

// ============================================================================
// Conflict Detection
// ============================================================================

export interface AircraftConflict {
  id: string;
  aircraft_1_id: string;
  aircraft_2_id: string;
  aircraft_1_callsign?: string;
  aircraft_2_callsign?: string;
  detected_at: string;
  resolved_at?: string;
  min_horizontal_distance: number; // nautical miles
  min_vertical_distance: number; // feet
  time_to_cpa: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved';
}

// ============================================================================
// Configuration
// ============================================================================

export interface AirframesSettings {
  api_key: string;
  api_url: string;
  ws_url: string;
  enabled?: boolean;
}

export interface Tar1090Settings {
  enabled: boolean;
  url: string;
  poll_interval: number;
}

export interface ADSBExchangeSettings {
  api_key: string;
  api_url: string;
  default_lat: number | null;
  default_lon: number | null;
  default_dist: number;
  poll_interval: number;
  enabled?: boolean;
}

export interface OpenSkySettings {
  default_lat: number | null;
  default_lon: number | null;
  default_radius: number;
  poll_interval: number;
  enabled?: boolean;
}

export interface WhisperSettings {
  server_url: string;
  language: string;
  model: string;
  temperature: number;
  beam_size: number;
}

export interface AudioSettings {
  sample_rate: number;
  chunk_duration: number;
  vad_threshold: number;
  vad_min_silence_duration: number;
  vad_speech_pad: number;
}

export interface SystemSettings {
  database_retention_days: number;
  log_level: string;
  enable_metrics: boolean;
}

// ============================================================================
// WebSocket Messages
// ============================================================================

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: string;
}

export interface ADSBBatchMessage extends WebSocketMessage {
  type: 'adsb_batch';
  count: number;
  data: ACARSMessage[];
}

export interface HFGCSAircraftEvent {
  event: 'detected' | 'updated' | 'lost';
  aircraft: HFGCSAircraft;
}

export interface HFGCSAircraftMessage extends WebSocketMessage<HFGCSAircraftEvent> {
  type: 'hfgcs_aircraft';
}

export interface EAMDetectedMessage extends WebSocketMessage<EAMMessage> {
  type: 'eam_detected';
}

export interface TranscriptionCompleteData {
  segmentId: string;
  text: string;
  metadata: Record<string, any>;
}

export interface TranscriptionCompleteMessage extends WebSocketMessage<TranscriptionCompleteData> {
  type: 'transcription_complete';
}

export interface ConflictMessage extends WebSocketMessage<AircraftConflict> {
  type: 'conflict_detected' | 'conflict_resolved' | 'conflict_updated';
}

// ============================================================================
// HFGCS and EAM
// ============================================================================

export interface HFGCSAircraft {
  id: string;
  hex?: string;
  callsign?: string;
  type?: string;
  detection_method: string;
  first_seen: string;
  last_seen: string;
  position?: AircraftPosition;
  messages: ACARSMessage[];
}

export interface EAMMessage {
  id: string;
  timestamp: string;
  type: 'EAM' | 'SKYKING';
  message_body: string;
  header?: string;
  codeword?: string;
  confidence: number;
  recording_segment_id?: string;
  verified: boolean;
  verification_notes?: string;
}

// ============================================================================
// API Responses
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  errorId?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  count: number;
  offset?: number;
  limit?: number;
  total?: number;
}

// ============================================================================
// Photo and Media
// ============================================================================

export interface AircraftPhoto {
  id: string;
  aircraft_id: string;
  url: string;
  thumbnail_url?: string;
  local_path?: string;
  photographer?: string;
  source: string;
  timestamp: string;
}

export interface VideoGenerationRequest {
  message_id: string;
  template?: string;
  duration?: number;
  format?: string;
}

export interface VideoGenerationResult {
  video_id: string;
  output_path: string;
  duration: number;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
}

// ============================================================================
// Statistics
// ============================================================================

export interface DatabaseStats {
  total_messages: number;
  total_aircraft: number;
  active_aircraft: number;
  messages_by_category: Record<string, number>;
  messages_by_airline: Record<string, number>;
  database_size_mb: number;
}

export interface DataSourceStats {
  connected: boolean;
  tracked_aircraft?: number;
  last_update?: string;
  update_interval?: number;
  message_count?: number;
}

export interface ServiceStatus {
  tar1090: boolean;
  airframes: boolean;
  adsbexchange: boolean;
  opensky: boolean;
}

// ============================================================================
// Admin and Authentication
// ============================================================================

export interface AdminSettings {
  category: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface AuthToken {
  token: string;
  expires_at: string;
}

// ============================================================================
// Emergency Scanner
// ============================================================================

export interface EmergencyFeed {
  id: string;
  name: string;
  url: string;
  location: string;
  type: 'police' | 'fire' | 'ems' | 'other';
  active: boolean;
}

export interface EmergencyEvent {
  id: string;
  feed_id: string;
  timestamp: string;
  duration: number;
  transcription?: string;
  keywords?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// Store Interfaces
// ============================================================================

export interface MessageStoreState {
  messages: ACARSMessage[];
  filteredMessages: ACARSMessage[];
  filter: string;
  selectedCategory: string | null;
  selectedAirline: string | null;
  addMessage: (message: ACARSMessage) => void;
  addMessages: (messages: ACARSMessage[]) => void;
  setFilter: (filter: string) => void;
  setCategory: (category: string | null) => void;
  setAirline: (airline: string | null) => void;
  clearMessages: () => void;
}

export interface AdminStoreState {
  settings: Record<string, AdminSettings>;
  serviceStatus: ServiceStatus;
  dataSourceStats: Record<string, DataSourceStats>;
  loadSettings: () => Promise<void>;
  updateSetting: (category: string, key: string, value: any) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

// ============================================================================
// Broadcast Configuration
// ============================================================================

export interface BroadcastConfig {
  modes: {
    airport_focus: AirportFocusConfig;
    military_watch: MilitaryWatchConfig;
    global_overview: GlobalOverviewConfig;
    eam_alert: EAMAlertConfig;
  };
  layout: BroadcastLayoutConfig;
  narrative: NarrativeConfig;
  transitions: TransitionConfig;
}

export interface AirportFocusConfig {
  defaultAirport: string;
  radius: number;
  showRunways: boolean;
  showWeather: boolean;
}

export interface MilitaryWatchConfig {
  focusRegion: string;
  highlightTypes: string[];
  showEAMAlerts: boolean;
  autoSwitchOnEAM: boolean;
}

export interface GlobalOverviewConfig {
  showHeatmap: boolean;
  clusterMarkers: boolean;
  maxAircraft: number;
}

export interface EAMAlertConfig {
  autoReturn: boolean;
  returnDelay: number;
  playSound: boolean;
}

export interface BroadcastLayoutConfig {
  showHeader: boolean;
  showInfoPanel: boolean;
  showTicker: boolean;
  transparent: boolean;
}

export interface NarrativeConfig {
  enabled: boolean;
  updateInterval: number;
  templates: Record<string, string>;
}

export interface TransitionConfig {
  enabled: boolean;
  duration: number;
  autoRotate: boolean;
  rotateInterval: number;
}

export interface BroadcastMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: React.ComponentType<any>;
}

export interface BroadcastPreset {
  id: string;
  name: string;
  description: string;
  config: BroadcastConfig;
}

