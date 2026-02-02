/**
 * EAM Transcription Pre-processor
 * Cleans and normalizes Whisper transcriptions for improved EAM detection
 */

const AviationContextAnalyzer = require('./aviation-context-analyzer');

class EAMPreprocessor {
  constructor() {
    // NATO phonetic alphabet mapping
    this.phoneticMap = {
      'ALPHA': 'A', 'BRAVO': 'B', 'CHARLIE': 'C', 'DELTA': 'D',
      'ECHO': 'E', 'FOXTROT': 'F', 'GOLF': 'G', 'HOTEL': 'H',
      'INDIA': 'I', 'JULIET': 'J', 'JULIETT': 'J', 'KILO': 'K',
      'LIMA': 'L', 'MIKE': 'M', 'NOVEMBER': 'N', 'OSCAR': 'O',
      'PAPA': 'P', 'QUEBEC': 'Q', 'ROMEO': 'R', 'SIERRA': 'S',
      'TANGO': 'T', 'UNIFORM': 'U', 'VICTOR': 'V', 'WHISKEY': 'W',
      'WHISKY': 'W', 'XRAY': 'X', 'X-RAY': 'X', 'YANKEE': 'Y', 'ZULU': 'Z'
    };

    // Number word mapping
    this.numberMap = {
      'ZERO': '0', 'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4',
      'FIVE': '5', 'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9'
    };

    // Common Whisper mishearings for HFGCS
    this.commonErrors = {
      'Force': 'Foxtrot',
      'FORCE': 'FOXTROT',
      'Strong': 'Sierra',
      'STRONG': 'SIERRA',
      'Hilo': 'Hotel',
      'HILO': 'HOTEL',
      'Storm': 'Sierra',
      'STORM': 'SIERRA',
      'I think': '',
      'get back': '',
      'you know': '',
      'uh': '',
      'um': ''
    };
  }

  /**
   * Main cleaning pipeline - removes timestamps, [Unknown] markers, and normalizes text
   * @param {string} text - Raw transcription text
   * @returns {string} Cleaned text
   */
  cleanTranscription(text) {
    if (!text) return '';

    let cleaned = text;

    // Remove timestamps - multiple formats:
    // 1. Compact: 26/10/202519:33:2130s
    cleaned = cleaned.replace(/\d{2}\/\d{2}\/\d{4}\d{2}:\d{2}:\d{2}\d+s/g, '');
    
    // 2. Spaced date/time: 26/10/2025 19:33:21 30s
    cleaned = cleaned.replace(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s*\d*s?/g, '');
    
    // 3. ISO 8601 with T and Z: 2025-10-26T19:33:21Z or 2025-10-26T19:33:21
    cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|\.\d{3}Z)?/gi, '');
    
    // 4. ISO 8601 spaced: 2025-10-26 19:33:21
    cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g, '');
    
    // 5. Bracketed time codes: [00:12:34] or [12:34]
    cleaned = cleaned.replace(/\[?\d{1,2}:\d{2}(:\d{2})?\]?/g, '');
    
    // 6. Duration markers: 30s, 45sec, 2m30s (must handle compound like 2m30s)
    cleaned = cleaned.replace(/\d+\s*(m|min|minutes?)\s*\d*\s*(s|sec|seconds?)?\b/gi, '');
    cleaned = cleaned.replace(/\d+\s*(s|sec|seconds?)\b/gi, '');

    // Strip [Unknown] markers
    cleaned = cleaned.replace(/\[Unknown\]/gi, '');

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Convert to uppercase for consistency
    cleaned = cleaned.toUpperCase();

    return cleaned;
  }

  /**
   * Replace common Whisper transcription errors with correct phonetics
   * @param {string} text - Transcription text
   * @returns {string} Normalized text
   */
  normalizePhonetics(text) {
    if (!text) return '';

    let normalized = text;

    // Replace common errors
    for (const [error, correction] of Object.entries(this.commonErrors)) {
      const regex = new RegExp(error, 'gi');
      normalized = normalized.replace(regex, correction);
    }

    // Fix spacing around phonetics (e.g., "AlphaYankee" → "Alpha Yankee")
    // Insert space before uppercase letters that follow lowercase
    normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');

    return normalized;
  }

  /**
   * Extract NATO phonetic sequences and convert to alphanumeric
   * @param {string} text - Transcription text
   * @returns {Object} { original: string, decoded: string, phoneticCount: number }
   */
  extractPhoneticSequence(text) {
    if (!text) return { original: '', decoded: '', phoneticCount: 0 };

    const upperText = text.toUpperCase();
    const words = upperText.split(/\s+/);
    
    let decoded = '';
    let phoneticCount = 0;
    const originalParts = [];

    for (const word of words) {
      // Check if word is a NATO phonetic
      if (this.phoneticMap[word]) {
        decoded += this.phoneticMap[word];
        originalParts.push(word);
        phoneticCount++;
      }
      // Check if word is a number
      else if (this.numberMap[word]) {
        decoded += this.numberMap[word];
        originalParts.push(word);
      }
      // Check if word is already a digit
      else if (/^\d$/.test(word)) {
        decoded += word;
        originalParts.push(word);
      }
      // Check if word is a single letter (already decoded)
      else if (/^[A-Z]$/.test(word)) {
        decoded += word;
        originalParts.push(word);
      }
    }

    return {
      original: originalParts.join(' '),
      decoded: decoded,
      phoneticCount: phoneticCount
    };
  }

  /**
   * Detect EAM indicators in transcription
   * @param {string} text - Cleaned transcription text
   * @returns {Object} Boolean flags for various EAM indicators
   */
  detectEAMIndicators(text) {
    if (!text) {
      return {
        hasStandBy: false,
        hasMessageFollows: false,
        hasISayAgain: false,
        hasMessageLength: false,
        hasRepeatedPatterns: false,
        hasAuthentication: false,
        hasSkyking: false
      };
    }

    const upperText = text.toUpperCase();

    // Detect various EAM indicators
    const hasStandBy = /STAND\s*BY/i.test(upperText);
    const hasMessageFollows = /MESSAGE\s*(FOLLOWS|BEGINS)/i.test(upperText);
    const hasISayAgain = /I\s*SAY\s*AGAIN/i.test(upperText);
    const hasMessageLength = /MESSAGE\s*OF\s*\d+\s*CHARACTER/i.test(upperText);
    const hasAuthentication = /AUTHENTICATION/i.test(upperText);
    const hasSkyking = /SKYKING/i.test(upperText);

    // Check for repeated patterns (same phrase appears 2+ times)
    const hasRepeatedPatterns = this.detectRepeatedPatterns(upperText);

    return {
      hasStandBy,
      hasMessageFollows,
      hasISayAgain,
      hasMessageLength,
      hasRepeatedPatterns,
      hasAuthentication,
      hasSkyking
    };
  }

  /**
   * Detect if text has repeated patterns (common in EAMs)
   * Optimized with early exit and scan window limit
   * @param {string} text - Text to analyze
   * @returns {boolean} True if repeated patterns found
   */
  detectRepeatedPatterns(text) {
    if (!text) return false;

    const words = text.split(/\s+/);
    const maxScanWords = 200; // Limit scan window to first 200 words
    const scanWords = words.slice(0, Math.min(words.length, maxScanWords));
    
    // Use a map to track seen phrases for O(n) performance
    const phraseMap = new Map();
    
    // Look for 3+ word phrases that repeat
    for (let phraseLen = 3; phraseLen <= 8; phraseLen++) {
      // Early exit if not enough words left
      if (scanWords.length < phraseLen * 2) continue;
      
      phraseMap.clear(); // Reset map for each phrase length
      
      for (let i = 0; i <= scanWords.length - phraseLen; i++) {
        const phrase = scanWords.slice(i, i + phraseLen).join(' ');
        
        if (phraseMap.has(phrase)) {
          // Found a repeat!
          return true;
        }
        
        phraseMap.set(phrase, i);
      }
    }

    return false;
  }

  /**
   * Calculate initial confidence score based on indicators and phonetic content
   * @param {Object} indicators - EAM indicator flags
   * @param {number} phoneticCount - Number of phonetic characters found
   * @returns {number} Confidence score (0-100)
   */
  estimateConfidence(indicators, phoneticCount) {
    let score = 0;

    // Add points for each indicator present
    if (indicators.hasStandBy) score += 20;
    if (indicators.hasMessageFollows) score += 20;
    if (indicators.hasISayAgain) score += 20;
    if (indicators.hasMessageLength) score += 15;
    if (indicators.hasRepeatedPatterns) score += 15;
    if (indicators.hasAuthentication) score += 20;
    if (indicators.hasSkyking) score += 25;

    // Add points for phonetic content (10 points per 5 phonetic characters)
    score += Math.floor(phoneticCount / 5) * 10;

    // Cap at 100
    return Math.min(score, 100);
  }
}

module.exports = EAMPreprocessor;

