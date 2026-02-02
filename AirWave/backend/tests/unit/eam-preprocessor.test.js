const EAMPreprocessor = require('../../services/eam-preprocessor');

describe('EAMPreprocessor', () => {
  let preprocessor;
  
  beforeEach(() => {
    preprocessor = new EAMPreprocessor();
  });
  
  describe('cleanTranscription', () => {
    test('should remove compact timestamps', () => {
      const input = 'Alpha Bravo 26/10/202519:33:2130s Charlie Delta';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('26/10/2025');
      expect(result).toContain('ALPHA BRAVO');
      expect(result).toContain('CHARLIE DELTA');
    });

    test('should remove spaced date/time', () => {
      const input = 'Alpha Bravo 26/10/2025 19:33:21 30s Charlie Delta';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('26/10/2025');
      expect(result).not.toContain('19:33:21');
      expect(result).toContain('ALPHA BRAVO');
      expect(result).toContain('CHARLIE DELTA');
    });

    test('should remove ISO 8601 timestamps with Z', () => {
      const input = 'Alpha 2025-10-26T19:33:21Z Bravo';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('2025-10-26');
      expect(result).not.toContain('19:33:21');
      expect(result).toBe('ALPHA BRAVO');
    });

    test('should remove ISO 8601 timestamps without Z', () => {
      const input = 'Alpha 2025-10-26T19:33:21 Bravo';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('2025-10-26');
      expect(result).not.toContain('T19:33:21');
      expect(result).toBe('ALPHA BRAVO');
    });

    test('should remove ISO 8601 spaced timestamps', () => {
      const input = 'Alpha 2025-10-26 19:33:21 Bravo';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('2025-10-26');
      expect(result).not.toContain('19:33:21');
      expect(result).toBe('ALPHA BRAVO');
    });

    test('should remove bracketed time codes', () => {
      const input = 'Alpha [00:12:34] Bravo [12:34] Charlie';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('[00:12:34]');
      expect(result).not.toContain('[12:34]');
      expect(result).toBe('ALPHA BRAVO CHARLIE');
    });

    test('should remove duration markers', () => {
      const input = 'Alpha 30s Bravo 45sec Charlie 2m30s Delta';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('30s');
      expect(result).not.toContain('45sec');
      expect(result).not.toContain('2m30s');
      expect(result).toBe('ALPHA BRAVO CHARLIE DELTA');
    });

    test('should remove [Unknown] markers', () => {
      const input = 'Alpha [Unknown] Bravo [Unknown] Charlie';
      const result = preprocessor.cleanTranscription(input);
      expect(result).not.toContain('[Unknown]');
      expect(result).toContain('ALPHA');
      expect(result).toContain('BRAVO');
      expect(result).toContain('CHARLIE');
    });

    test('should normalize whitespace', () => {
      const input = 'Alpha    Bravo     Charlie   Delta';
      const result = preprocessor.cleanTranscription(input);
      expect(result).toBe('ALPHA BRAVO CHARLIE DELTA');
    });

    test('should convert to uppercase', () => {
      const input = 'alpha bravo Charlie DELTA';
      const result = preprocessor.cleanTranscription(input);
      expect(result).toBe('ALPHA BRAVO CHARLIE DELTA');
    });

    test('should handle empty input', () => {
      const result = preprocessor.cleanTranscription('');
      expect(result).toBe('');
    });

    test('should handle null input', () => {
      const result = preprocessor.cleanTranscription(null);
      expect(result).toBe('');
    });

    test('should handle mixed timestamp formats', () => {
      const input = 'Alpha 26/10/2025 19:33:21 Bravo 2025-10-26T19:33:21Z Charlie [00:12:34] Delta 30s';
      const result = preprocessor.cleanTranscription(input);
      expect(result).toBe('ALPHA BRAVO CHARLIE DELTA');
    });
  });
  
  describe('normalizePhonetics', () => {
    test('should fix Force to Foxtrot', () => {
      const input = 'Force Bravo Charlie';
      const result = preprocessor.normalizePhonetics(input);
      expect(result).toContain('Foxtrot');
      expect(result).not.toContain('Force');
    });

    test('should fix Strong to Sierra', () => {
      const input = 'Alpha Strong Charlie';
      const result = preprocessor.normalizePhonetics(input);
      expect(result).toContain('Sierra');
      expect(result).not.toContain('Strong');
    });

    test('should fix Hilo to Hotel', () => {
      const input = 'Alpha Hilo Charlie';
      const result = preprocessor.normalizePhonetics(input);
      expect(result).toContain('Hotel');
      expect(result).not.toContain('Hilo');
    });

    test('should handle multiple errors in one string', () => {
      const input = 'Force Strong Hilo';
      const result = preprocessor.normalizePhonetics(input);
      expect(result).toContain('Foxtrot');
      expect(result).toContain('Sierra');
      expect(result).toContain('Hotel');
    });

    test('should preserve correct phonetics', () => {
      const input = 'Alpha Bravo Charlie Delta';
      const result = preprocessor.normalizePhonetics(input);
      expect(result).toContain('Alpha');
      expect(result).toContain('Bravo');
      expect(result).toContain('Charlie');
      expect(result).toContain('Delta');
    });

    test('should remove filler words', () => {
      const input = 'Alpha I think Bravo uh Charlie';
      const result = preprocessor.normalizePhonetics(input);
      expect(result).not.toContain('I think');
      expect(result).not.toContain('uh');
    });
  });
  
  describe('extractPhoneticSequence', () => {
    test('should extract simple phonetic sequence', () => {
      const input = 'ALPHA BRAVO CHARLIE';
      const result = preprocessor.extractPhoneticSequence(input);
      expect(result.decoded).toBe('ABC');
      expect(result.phoneticCount).toBe(3);
    });

    test('should handle numbers', () => {
      const input = 'ALPHA FOUR BRAVO SEVEN';
      const result = preprocessor.extractPhoneticSequence(input);
      expect(result.decoded).toBe('A4B7');
    });

    test('should handle number words', () => {
      const input = 'ALPHA SEVEN ROMEO';
      const result = preprocessor.extractPhoneticSequence(input);
      expect(result.decoded).toBe('A7R');
    });

    test('should handle mixed content', () => {
      const input = 'ALPHA 4 BRAVO 5 CHARLIE';
      const result = preprocessor.extractPhoneticSequence(input);
      expect(result.decoded).toBe('A4B5C');
    });

    test('should return both original and decoded', () => {
      const input = 'ALPHA BRAVO CHARLIE';
      const result = preprocessor.extractPhoneticSequence(input);
      expect(result.original).toBe('ALPHA BRAVO CHARLIE');
      expect(result.decoded).toBe('ABC');
    });

    test('should handle empty input', () => {
      const result = preprocessor.extractPhoneticSequence('');
      expect(result.decoded).toBe('');
      expect(result.phoneticCount).toBe(0);
    });

    test('should handle long phonetic sequences', () => {
      const input = 'ALPHA BRAVO CHARLIE DELTA ECHO FOXTROT GOLF HOTEL INDIA JULIET';
      const result = preprocessor.extractPhoneticSequence(input);
      expect(result.decoded).toBe('ABCDEFGHIJ');
      expect(result.phoneticCount).toBe(10);
    });
  });
  
  describe('detectEAMIndicators', () => {
    test('should detect "stand by"', () => {
      const input = 'PLEASE STAND BY FOR MESSAGE';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasStandBy).toBe(true);
    });

    test('should detect "message follows"', () => {
      const input = 'MESSAGE FOLLOWS ALPHA BRAVO';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasMessageFollows).toBe(true);
    });

    test('should detect "I say again"', () => {
      const input = 'ALPHA BRAVO I SAY AGAIN ALPHA BRAVO';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasISayAgain).toBe(true);
    });

    test('should detect message length', () => {
      const input = 'MESSAGE OF 30 CHARACTERS FOLLOWS';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasMessageLength).toBe(true);
    });

    test('should detect authentication', () => {
      const input = 'AUTHENTICATION ALPHA BRAVO';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasAuthentication).toBe(true);
    });

    test('should detect skyking', () => {
      const input = 'SKYKING SKYKING DO NOT ANSWER';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasSkyking).toBe(true);
    });

    test('should detect multiple indicators', () => {
      const input = 'STAND BY MESSAGE FOLLOWS I SAY AGAIN';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasStandBy).toBe(true);
      expect(result.hasMessageFollows).toBe(true);
      expect(result.hasISayAgain).toBe(true);
    });

    test('should return false for all indicators on empty input', () => {
      const result = preprocessor.detectEAMIndicators('');
      expect(result.hasStandBy).toBe(false);
      expect(result.hasMessageFollows).toBe(false);
      expect(result.hasISayAgain).toBe(false);
      expect(result.hasMessageLength).toBe(false);
      expect(result.hasRepeatedPatterns).toBe(false);
    });

    test('should detect repeated patterns', () => {
      const input = 'ALPHA BRAVO CHARLIE ALPHA BRAVO CHARLIE';
      const result = preprocessor.detectEAMIndicators(input);
      expect(result.hasRepeatedPatterns).toBe(true);
    });
  });
  
  describe('estimateConfidence', () => {
    test('should return low score for no indicators and few phonetics', () => {
      const indicators = {
        hasStandBy: false,
        hasMessageFollows: false,
        hasISayAgain: false,
        hasMessageLength: false,
        hasRepeatedPatterns: false,
        hasAuthentication: false,
        hasSkyking: false
      };
      const result = preprocessor.estimateConfidence(indicators, 3);
      expect(result).toBeLessThan(30);
    });

    test('should return high score for multiple indicators and many phonetics', () => {
      const indicators = {
        hasStandBy: true,
        hasMessageFollows: true,
        hasISayAgain: true,
        hasMessageLength: true,
        hasRepeatedPatterns: true,
        hasAuthentication: false,
        hasSkyking: false
      };
      const result = preprocessor.estimateConfidence(indicators, 30);
      expect(result).toBeGreaterThan(70);
    });

    test('should cap score at 100', () => {
      const indicators = {
        hasStandBy: true,
        hasMessageFollows: true,
        hasISayAgain: true,
        hasMessageLength: true,
        hasRepeatedPatterns: true,
        hasAuthentication: true,
        hasSkyking: true
      };
      const result = preprocessor.estimateConfidence(indicators, 100);
      expect(result).toBe(100);
    });

    test('should give bonus for skyking', () => {
      const indicators = {
        hasStandBy: false,
        hasMessageFollows: false,
        hasISayAgain: false,
        hasMessageLength: false,
        hasRepeatedPatterns: false,
        hasAuthentication: false,
        hasSkyking: true
      };
      const result = preprocessor.estimateConfidence(indicators, 0);
      expect(result).toBe(25); // Skyking indicator gives 25 points
    });

    test('should handle empty indicators', () => {
      const indicators = {
        hasStandBy: false,
        hasMessageFollows: false,
        hasISayAgain: false,
        hasMessageLength: false,
        hasRepeatedPatterns: false,
        hasAuthentication: false,
        hasSkyking: false
      };
      const result = preprocessor.estimateConfidence(indicators, 0);
      expect(result).toBe(0);
    });
  });
});

