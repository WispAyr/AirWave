'use client'

import { useState } from 'react'
import { AlertTriangle, Radio, Clock, RefreshCw, Link } from 'lucide-react'

interface EAMMessage {
  id: number
  message_type: 'EAM' | 'SKYKING'
  header: string | null
  message_body: string
  message_length: number | null
  confidence_score: number
  repeat_count: number
  first_detected: string
  last_detected: string
  recording_ids: string[]
  raw_transcription: string
  codeword: string | null
  time_code: string | null
  authentication: string | null
  multi_segment?: boolean
  segment_count?: number
  duration_seconds?: number
}

interface EAMMessageCardProps {
  message: EAMMessage
  onVerify?: (id: number, verified: boolean) => void
  onDelete?: (id: number) => void
}

export default function EAMMessageCard({ message, onVerify, onDelete }: EAMMessageCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  // Determine confidence level
  const confidenceLevel = message.confidence_score > 75 ? 'high' : 
                          message.confidence_score > 50 ? 'medium' : 'low'
  
  // Check if message is recent (within last 5 minutes)
  const isRecent = new Date().getTime() - new Date(message.first_detected).getTime() < 5 * 60 * 1000
  
  // Format message body into 5-character groups
  const formatMessageBody = (body: string) => {
    return body.match(/.{1,5}/g) || []
  }

  // Calculate time span for multi-segment messages
  const getTimeSpan = () => {
    if (!message.multi_segment || !message.first_detected || !message.last_detected) return null
    const start = new Date(message.first_detected).getTime()
    const end = new Date(message.last_detected).getTime()
    return Math.round((end - start) / 1000)
  }

  const timeSpan = getTimeSpan()

  return (
    <div
      className={`eam-message-card ${confidenceLevel}-confidence ${isRecent ? 'recent' : ''} ${message.multi_segment ? 'border-l-4 border-blue-500/50 shadow-lg shadow-blue-500/20' : ''}`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className={`eam-badge type-${message.message_type.toLowerCase()}`}>
            {message.message_type}
          </span>
          {message.multi_segment && (
            <div 
              className="inline-flex items-center px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-mono border border-blue-400/50"
              title={`This EAM was detected across ${message.segment_count} audio segments${timeSpan ? ` spanning ${timeSpan} seconds` : ''}`}
            >
              <Link className="w-3 h-3 mr-1" />
              {message.segment_count} segments
            </div>
          )}
          {message.repeat_count > 1 && (
            <span className="repeat-badge">
              <RefreshCw className="w-3 h-3 inline mr-1" />
              ×{message.repeat_count} REPEATS
            </span>
          )}
          {isRecent && (
            <span className="px-2 py-1 bg-orange-500/30 text-orange-300 text-xs font-bold rounded animate-pulse">
              🔴 NEW
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500 font-mono">
          <Clock className="w-3 h-3" />
          {new Date(message.first_detected).toLocaleString()}
        </div>
      </div>

      {/* Confidence Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400 font-mono">CONFIDENCE</span>
          <span className={`font-bold font-mono ${
            confidenceLevel === 'high' ? 'text-green-400' :
            confidenceLevel === 'medium' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {message.confidence_score}%
          </span>
        </div>
        <div className="confidence-bar">
          <div 
            className={`confidence-fill ${confidenceLevel}`}
            style={{ width: `${message.confidence_score}%` }}
          />
        </div>
      </div>

      {/* Message Header (for EAM) */}
      {message.message_type === 'EAM' && message.header && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 font-mono mb-1">HEADER</div>
          <div className="eam-header">{message.header}</div>
          {message.message_length && (
            <div className="text-xs text-gray-500 mt-1">
              Message Length: {message.message_length} characters
            </div>
          )}
        </div>
      )}

      {/* Skyking Codeword and Details */}
      {message.message_type === 'SKYKING' && message.codeword && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mr-2" />
            <span className="text-xs text-red-400 font-mono font-bold">SKYKING ALERT</span>
          </div>
          <div className="text-xs text-gray-400 font-mono mb-1">CODEWORD</div>
          <div className="text-2xl font-bold text-red-400 font-mono tracking-widest mb-2">
            {message.codeword}
          </div>
          {message.time_code && (
            <div className="text-sm mb-1">
              <span className="text-gray-400">TIME:</span>{' '}
              <span className="text-blue-400 font-mono">{message.time_code}</span>
            </div>
          )}
          {message.authentication && (
            <div className="text-sm">
              <span className="text-gray-400">AUTH:</span>{' '}
              <span className="text-green-400 font-mono">{message.authentication}</span>
            </div>
          )}
        </div>
      )}

      {/* Message Body */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 font-mono mb-1">MESSAGE BODY</div>
        <div className="eam-message-body">
          {formatMessageBody(message.message_body).map((group, i) => (
            <span key={i} className="eam-character-group">{group}</span>
          ))}
        </div>
      </div>

      {/* Multi-segment Timeline Visualization */}
      {message.multi_segment && message.segment_count && message.segment_count > 1 && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 font-mono mb-2">
            DETECTION TIMELINE ({timeSpan}s span)
          </div>
          <div className="relative h-8 bg-gray-800/50 rounded border border-gray-700">
            {/* Timeline bar */}
            <div className="absolute inset-0 flex items-center px-2">
              {/* Render tick marks for each recording */}
              {message.recording_ids.map((id, idx) => {
                const position = (idx / (message.recording_ids.length - 1 || 1)) * 100;
                return (
                  <div
                    key={id}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                    title={`Recording ${id}`}
                  >
                    <div className="w-0.5 h-4 bg-blue-400"></div>
                    <div className="text-[8px] text-blue-300 mt-1 whitespace-nowrap">
                      {idx === 0 ? 'Start' : idx === message.recording_ids.length - 1 ? 'End' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Gradient overlay to show span */}
            <div
              className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-blue-500/20 rounded"
              style={{ margin: '0 2px' }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
            <span>{new Date(message.first_detected).toLocaleTimeString()}</span>
            <span>{message.segment_count} segments</span>
            <span>{new Date(message.last_detected).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Repeat Information */}
      {message.repeat_count > 1 && (
        <div className="text-xs text-blue-400 font-mono mb-3">
          First detected: {new Date(message.first_detected).toLocaleString()}
          <br />
          Last detected: {new Date(message.last_detected).toLocaleString()}
        </div>
      )}

      {/* Expandable Details */}
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-400 hover:text-gray-300 font-mono flex items-center">
          <span>Show Details</span>
        </summary>
        <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
          <div>
            <span className="text-gray-500 font-mono">Message ID:</span>
            <div className="mt-1 text-gray-400 font-mono text-xs">#{message.id}</div>
          </div>
          <div>
            <span className="text-gray-500 font-mono">Recording IDs ({message.recording_ids.length}):</span>
            {message.multi_segment && message.segment_count && (
              <div className="mt-1 mb-2 text-blue-400 text-xs font-mono flex items-center">
                <Link className="w-3 h-3 mr-1" />
                Multi-segment detection across {message.segment_count} recordings
                {timeSpan && ` (${timeSpan}s span)`}
              </div>
            )}
            <div className="mt-1 text-gray-400 font-mono text-xs space-y-1">
              {message.recording_ids.map((id, idx) => (
                <div key={idx} className="flex items-center">
                  <Radio className="w-3 h-3 mr-1" />
                  {id}
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="text-gray-500 font-mono">Raw Transcription:</span>
            <div className="mt-1 bg-black/40 p-2 rounded text-gray-300 font-mono text-xs max-h-32 overflow-y-auto">
              {message.raw_transcription}
            </div>
          </div>
        </div>
      </details>

      {/* Action Buttons (if callbacks provided) */}
      {(onVerify || onDelete) && (
        <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-700">
          {onVerify && (
            <button
              onClick={() => onVerify(message.id, true)}
              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-mono transition-colors"
            >
              ✓ Verify
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-mono transition-colors"
            >
              ✗ False Positive
            </button>
          )}
        </div>
      )}
    </div>
  )
}

