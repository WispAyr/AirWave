const AviationContextAnalyzer = require('./aviation-context-analyzer');

/**
 * Enhances ATC transcriptions with context from ACARS messages
 * Helps identify speakers and add aviation context
 */
class ContextEnhancer {
  constructor(database) {
    this.database = database;
    this.aviationAnalyzer = new AviationContextAnalyzer();
  }

  /**
   * Enhance transcription with contextual data
   * @param {Object} transcription - Transcription data
   * @param {string} feedId - ATC feed identifier
   * @returns {Object} Enhanced transcription with speaker hints
   */
  async enhanceTranscription(transcription, feedId) {
    const enhanced = { ...transcription };

    try {
      // Extract ICAO code from feedId (e.g., kjfk_twr → KJFK)
      const icao = feedId.split('_')[0].toUpperCase();
      
      // Get recent ACARS messages from/to this airport
      const recentFlights = await this.getRecentFlightsNearAirport(icao);

      // Try to identify callsigns in the transcription
      const identifiedCallsigns = this.extractCallsigns(transcription.text, recentFlights);

      // Analyze aviation-specific content using data models
      const aviationAnalysis = this.aviationAnalyzer.analyzeTranscription(transcription.text);

      // Add comprehensive context
      enhanced.context = {
        airport: icao,
        feedType: this.getFeedType(feedId), // tower, ground, approach
        identifiedCallsigns: identifiedCallsigns,
        speakerHints: this.guessSpeakers(transcription.text, identifiedCallsigns),
        nearbyFlights: recentFlights.slice(0, 5), // Top 5 most recent
        aviation: aviationAnalysis, // Structured aviation data
        messageType: aviationAnalysis.messageType || 'UNKNOWN',
        safetyCritical: aviationAnalysis.safetyCritical || false
      };

      return enhanced;
    } catch (error) {
      console.error('Error enhancing transcription:', error);
      return transcription;
    }
  }

  /**
   * Get feed type from ID
   */
  getFeedType(feedId) {
    if (feedId.includes('_twr')) return 'Tower';
    if (feedId.includes('_gnd')) return 'Ground';
    if (feedId.includes('_app')) return 'Approach';
    if (feedId.includes('_dep')) return 'Departure';
    if (feedId.includes('_ctr')) return 'Center';
    return 'Unknown';
  }

  /**
   * Get recent flights near an airport from ACARS database
   */
  async getRecentFlightsNearAirport(icao) {
    if (!this.database) return [];

    try {
      // Query recent messages mentioning this airport
      const messages = this.database.searchMessages(icao, 50);
      
      const flights = new Set();
      messages.forEach(msg => {
        if (msg.flight) flights.add(msg.flight);
      });

      return Array.from(flights);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract callsigns from transcription text
   * Matches common patterns: ABC123, United 123, Delta 456, etc.
   */
  extractCallsigns(text, knownFlights = []) {
    const callsigns = [];
    
    // Pattern 1: Airline + Number (e.g., "United 123", "Delta 456")
    const airlinePattern = /(United|Delta|American|Southwest|JetBlue|Alaska|Spirit|Frontier|Allegiant)\s+(\d{1,4})/gi;
    let match;
    while ((match = airlinePattern.exec(text)) !== null) {
      callsigns.push(`${match[1]} ${match[2]}`);
    }

    // Pattern 2: Three-letter code + numbers (e.g., "UAL123", "DAL456")
    const codePattern = /([A-Z]{3})(\d{1,4})/g;
    while ((match = codePattern.exec(text)) !== null) {
      callsigns.push(`${match[1]}${match[2]}`);
    }

    // Pattern 3: Known flights from ACARS
    knownFlights.forEach(flight => {
      if (text.toUpperCase().includes(flight.toUpperCase())) {
        callsigns.push(flight);
      }
    });

    // Remove duplicates
    return [...new Set(callsigns)];
  }

  /**
   * Guess who is speaking based on linguistic patterns
   */
  guessSpeakers(text, callsigns) {
    const segments = text.split(/[.!?]/).filter(s => s.trim());
    const speakers = [];

    segments.forEach((segment, idx) => {
      const lower = segment.toLowerCase();
      
      // ATC patterns
      const atcPatterns = [
        'cleared', 'runway', 'contact', 'hold short', 'turn left', 'turn right',
        'climb', 'descend', 'maintain', 'taxi', 'wind', 'altimeter'
      ];

      // Pilot patterns
      const pilotPatterns = [
        'roger', 'wilco', 'affirm', 'negative', 'request', 'with you',
        'checking in', 'ready'
      ];

      const hasATCPattern = atcPatterns.some(p => lower.includes(p));
      const hasPilotPattern = pilotPatterns.some(p => lower.includes(p));

      let speaker = 'Unknown';
      if (hasATCPattern && !hasPilotPattern) {
        speaker = 'ATC';
      } else if (hasPilotPattern && !hasATCPattern) {
        speaker = 'Pilot';
      } else if (callsigns.length > 0) {
        // If callsign mentioned, likely pilot responding
        speaker = callsigns.some(c => lower.includes(c.toLowerCase())) ? 'Pilot' : 'ATC';
      }

      speakers.push({
        segment: segment.trim(),
        speaker,
        confidence: hasATCPattern || hasPilotPattern ? 'medium' : 'low'
      });
    });

    return speakers;
  }

  /**
   * Add speaker labels to transcription text
   */
  addSpeakerLabels(text, speakerHints) {
    if (!speakerHints || speakerHints.length === 0) return text;

    return speakerHints
      .map(hint => `[${hint.speaker}] ${hint.segment}`)
      .join('\n');
  }
}

module.exports = ContextEnhancer;

