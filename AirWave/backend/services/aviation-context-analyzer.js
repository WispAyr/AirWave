const fs = require('fs');
const path = require('path');

/**
 * Analyzes ATC transcriptions using aviation data models
 * Extracts structured data: runways, altitudes, headings, Q-codes, etc.
 */
class AviationContextAnalyzer {
  constructor() {
    this.loadAviationData();
  }

  /**
   * Load aviation reference data
   */
  loadAviationData() {
    try {
      // Load phonetic alphabet
      const phoneticPath = path.join(__dirname, '../../aviation_data_model_v1.0/csv/phonetic_alphabet.csv');
      this.phoneticAlphabet = this.parseCSV(phoneticPath);

      // Load flight phases
      const phasePath = path.join(__dirname, '../../aviation_data_model_v1.0/csv/flight_phase.csv');
      this.flightPhases = this.parseCSV(phasePath);

      // Load aviation units
      const unitsPath = path.join(__dirname, '../../aviation_data_model_v1.0/csv/aviation_units.csv');
      this.aviationUnits = this.parseCSV(unitsPath);

      console.log('✅ Aviation context data loaded');
    } catch (error) {
      console.error('Error loading aviation data:', error.message);
    }
  }

  /**
   * Parse CSV file
   */
  parseCSV(filepath) {
    if (!fs.existsSync(filepath)) return [];
    
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((header, i) => {
        obj[header.trim()] = values[i]?.trim();
      });
      return obj;
    });
  }

  /**
   * Extract structured aviation data from transcription
   */
  analyzeTranscription(text) {
    const analysis = {
      runways: this.extractRunways(text),
      altitudes: this.extractAltitudes(text),
      headings: this.extractHeadings(text),
      speeds: this.extractSpeeds(text),
      frequencies: this.extractFrequencies(text),
      qCodes: this.extractQCodes(text),
      squawkCodes: this.extractSquawkCodes(text),
      flightLevels: this.extractFlightLevels(text),
      phoneticSpellings: this.extractPhoneticSpellings(text),
      clearances: this.extractClearances(text),
      positions: this.extractPositions(text)
    };

    // Add derived metadata
    analysis.messageType = this.classifyMessageType(text, analysis);
    analysis.safetyCritical = this.isSafetyCritical(text, analysis);

    return analysis;
  }

  /**
   * Extract runway designators (e.g., "04R", "22L", "13")
   */
  extractRunways(text) {
    const runways = [];
    
    // Pattern: runway + number + optional L/R/C
    const pattern = /runway\s+(\d{1,2}[LRC]?)|(\d{1,2}[LRC]?)\s*(?:left|right|center)?/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const rwy = match[1] || match[2];
      if (rwy && !runways.includes(rwy)) {
        runways.push(rwy.toUpperCase());
      }
    }

    return runways;
  }

  /**
   * Extract altitudes (e.g., "10,000 feet", "FL350")
   */
  extractAltitudes(text) {
    const altitudes = [];
    
    // Pattern 1: Flight levels (FL350, FL240)
    const flPattern = /FL\s*(\d{3})/gi;
    let match;
    while ((match = flPattern.exec(text)) !== null) {
      altitudes.push({ value: parseInt(match[1]) * 100, unit: 'feet', type: 'flight_level' });
    }

    // Pattern 2: Explicit altitudes
    const altPattern = /(\d{1,2}[,\s]?\d{3})\s*(?:feet|ft)/gi;
    while ((match = altPattern.exec(text)) !== null) {
      const alt = parseInt(match[1].replace(/[,\s]/g, ''));
      altitudes.push({ value: alt, unit: 'feet', type: 'altitude' });
    }

    return altitudes;
  }

  /**
   * Extract headings (e.g., "heading 270", "turn left 090")
   */
  extractHeadings(text) {
    const headings = [];
    
    const pattern = /heading\s+(\d{3})|turn\s+(?:left|right)\s+(?:heading\s+)?(\d{3})/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const hdg = match[1] || match[2];
      if (hdg) {
        headings.push(parseInt(hdg));
      }
    }

    return headings;
  }

  /**
   * Extract speeds (e.g., "250 knots", "maintain 180")
   */
  extractSpeeds(text) {
    const speeds = [];
    
    const pattern = /(\d{2,3})\s*(?:knots|kts|kt)|maintain\s+(\d{2,3})/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const spd = match[1] || match[2];
      if (spd) {
        speeds.push({ value: parseInt(spd), unit: 'knots' });
      }
    }

    return speeds;
  }

  /**
   * Extract frequencies (e.g., "121.9", "124 point 5")
   */
  extractFrequencies(text) {
    const frequencies = [];
    
    // Pattern 1: Decimal notation (121.9)
    const decPattern = /(\d{3}\.\d{1,3})/g;
    let match;
    while ((match = decPattern.exec(text)) !== null) {
      const freq = parseFloat(match[1]);
      if (freq >= 118.0 && freq <= 137.0) { // VHF aviation range
        frequencies.push({ value: freq, unit: 'MHz' });
      }
    }

    // Pattern 2: Word notation (124 point 5)
    const wordPattern = /(\d{3})\s+(?:point|decimal)\s+(\d{1,2})/gi;
    while ((match = wordPattern.exec(text)) !== null) {
      const freq = parseFloat(`${match[1]}.${match[2]}`);
      if (freq >= 118.0 && freq <= 137.0) {
        frequencies.push({ value: freq, unit: 'MHz' });
      }
    }

    return frequencies;
  }

  /**
   * Extract Q-codes (QNH, QFE, etc.)
   */
  extractQCodes(text) {
    const qcodes = [];
    
    const pattern = /Q[A-Z]{2}\s+(\d{4})/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      qcodes.push({
        code: match[0].substring(0, 3).toUpperCase(),
        value: match[1]
      });
    }

    return qcodes;
  }

  /**
   * Extract squawk codes (4-digit transponder codes)
   */
  extractSquawkCodes(text) {
    const squawks = [];
    
    const pattern = /(?:squawk|transponder)\s+(\d{4})/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      squawks.push(match[1]);
    }

    return squawks;
  }

  /**
   * Extract flight levels
   */
  extractFlightLevels(text) {
    const levels = [];
    
    const pattern = /(?:climb|descend|maintain).*?(?:FL|flight level)\s*(\d{3})/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      levels.push({
        flightLevel: `FL${match[1]}`,
        altitude: parseInt(match[1]) * 100,
        unit: 'feet'
      });
    }

    return levels;
  }

  /**
   * Extract phonetic spellings (e.g., "Alpha Bravo Charlie")
   */
  extractPhoneticSpellings(text) {
    if (!this.phoneticAlphabet) return [];

    const phonetics = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 
                       'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 
                       'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
                       'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 
                       'X-ray', 'Yankee', 'Zulu'];

    const found = [];
    phonetics.forEach(phonetic => {
      if (text.includes(phonetic)) {
        found.push(phonetic);
      }
    });

    // Try to group into words (e.g., "Alpha Bravo" → "AB")
    if (found.length >= 2) {
      let sequence = '';
      found.forEach(p => {
        sequence += p.charAt(0);
      });
      return [{ phonetics: found, decoded: sequence }];
    }

    return found;
  }

  /**
   * Extract clearance types
   */
  extractClearances(text) {
    const clearances = [];
    
    const types = {
      takeoff: /cleared?\s+(?:for\s+)?takeoff/i,
      landing: /cleared?\s+(?:to\s+)?land/i,
      taxi: /taxi\s+(?:via|to)/i,
      pushback: /(?:cleared?\s+(?:to\s+)?push|pushback\s+approved)/i,
      startup: /(?:cleared?\s+(?:to\s+)?start|startup\s+approved)/i
    };

    Object.entries(types).forEach(([type, pattern]) => {
      if (pattern.test(text)) {
        clearances.push(type);
      }
    });

    return clearances;
  }

  /**
   * Extract position reports (intersections, navaids)
   */
  extractPositions(text) {
    const positions = [];
    
    // Common taxiway/intersection patterns
    const taxiways = text.match(/\b[A-Z]\d?\b/g) || [];
    const intersections = text.match(/\b[A-Z]{2,5}\b/g) || [];
    
    return {
      taxiways: [...new Set(taxiways)],
      intersections: [...new Set(intersections)]
    };
  }

  /**
   * Create structured aviation message from analysis
   */
  createStructuredMessage(transcription, analysis) {
    return {
      original_text: transcription,
      structured_data: {
        ...analysis,
        message_type: this.classifyMessageType(transcription, analysis),
        safety_critical: this.isSafetyCritical(transcription, analysis)
      },
      metadata: {
        analyzed_at: new Date().toISOString(),
        analyzer_version: '1.0.0'
      }
    };
  }

  /**
   * Classify message type based on content
   */
  classifyMessageType(text, analysis) {
    if (analysis.clearances.includes('takeoff')) return 'TAKEOFF_CLEARANCE';
    if (analysis.clearances.includes('landing')) return 'LANDING_CLEARANCE';
    if (analysis.clearances.includes('taxi')) return 'TAXI_INSTRUCTION';
    if (analysis.headings.length > 0 || analysis.altitudes.length > 0) return 'VECTOR';
    if (analysis.frequencies.length > 0) return 'FREQUENCY_CHANGE';
    if (analysis.squawkCodes.length > 0) return 'TRANSPONDER_ASSIGNMENT';
    return 'GENERAL_COMMUNICATION';
  }

  /**
   * Determine if message is safety-critical
   */
  isSafetyCritical(text, analysis) {
    const criticalKeywords = [
      'hold short', 'stop', 'abort', 'go around', 'emergency',
      'traffic', 'expedite', 'immediately', 'unable'
    ];

    return criticalKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    ) || analysis.clearances.length > 0;
  }
}

module.exports = AviationContextAnalyzer;

