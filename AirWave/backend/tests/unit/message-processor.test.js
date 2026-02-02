const MessageProcessor = require('../../services/message-processor');
const SchemaValidator = require('../../utils/schema-validator');

// Mock dependencies
const mockValidator = {
  validateACARSMessage: jest.fn(),
  validate: jest.fn()
};

const mockDatabase = {
  saveMessage: jest.fn(),
  incrementMessageCount: jest.fn(),
  getStats: jest.fn(),
  saveEAMMessage: jest.fn()
};

const mockHFGCSTracker = {
  processMessage: jest.fn(),
  isHFGCSAircraft: jest.fn()
};

const mockAircraftTracker = {
  updateAircraft: jest.fn(),
  getAircraft: jest.fn()
};

describe('MessageProcessor', () => {
  let messageProcessor;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create new instance
    messageProcessor = new MessageProcessor(
      mockValidator,
      mockDatabase,
      mockHFGCSTracker,
      mockAircraftTracker
    );

    // Default validator response
    mockValidator.validateACARSMessage.mockReturnValue({
      valid: true,
      errors: []
    });
  });

  describe('categorizeMessage', () => {
    it('should categorize OOOI messages correctly', () => {
      const message = {
        text: 'OUT 1234 OFF 1235',
        label: 'H1'
      };

      const category = messageProcessor.categorizeMessage(message);
      expect(category).toBe('oooi');
    });

    it('should categorize position messages correctly', () => {
      const message = {
        text: 'POS N4030W07400',
        label: '5Z'
      };

      const category = messageProcessor.categorizeMessage(message);
      expect(category).toBe('position');
    });

    it('should categorize CPDLC messages correctly', () => {
      const message = {
        text: 'REQUEST FL350',
        label: 'B6'
      };

      const category = messageProcessor.categorizeMessage(message);
      expect(category).toBe('cpdlc');
    });

    it('should categorize ADS-B messages correctly', () => {
      const message = {
        source_type: 'adsb',
        position: {
          lat: 40.7128,
          lon: -74.0060,
          altitude: 35000
        }
      };

      const category = messageProcessor.categorizeMessage(message);
      expect(category).toBe('adsb');
    });

    it('should categorize HFGCS messages correctly', () => {
      const message = {
        text: 'SKYKING SKYKING',
        frequency: 11175000
      };

      const category = messageProcessor.categorizeMessage(message);
      expect(category).toBe('hfgcs');
    });

    it('should default to general category for unknown messages', () => {
      const message = {
        text: 'Some random text',
        label: 'XX'
      };

      const category = messageProcessor.categorizeMessage(message);
      expect(category).toBe('general');
    });
  });

  describe('enrichMessage - OOOI detection', () => {
    it('should detect OUT event', () => {
      const message = {
        text: 'OUT 1234Z',
        label: 'H1'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.category).toBe('oooi');
      expect(enriched.oooi).toBeDefined();
      expect(enriched.oooi.event).toBe('OUT');
      expect(enriched.oooi.time).toBe('1234Z');
    });

    it('should detect OFF event', () => {
      const message = {
        text: 'OFF 1235Z',
        label: 'H1'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.oooi).toBeDefined();
      expect(enriched.oooi.event).toBe('OFF');
    });

    it('should detect ON event', () => {
      const message = {
        text: 'ON 1240Z',
        label: 'H1'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.oooi).toBeDefined();
      expect(enriched.oooi.event).toBe('ON');
    });

    it('should detect IN event', () => {
      const message = {
        text: 'IN 1245Z',
        label: 'H1'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.oooi).toBeDefined();
      expect(enriched.oooi.event).toBe('IN');
    });
  });

  describe('enrichMessage - Position detection', () => {
    it('should parse position coordinates', () => {
      const message = {
        text: 'POS N4030W07400,1234Z,FL350',
        label: '5Z'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.category).toBe('position');
      expect(enriched.position).toBeDefined();
      expect(enriched.position.coordinates).toBe('N4030W07400');
    });

    it('should extract altitude from position report', () => {
      const message = {
        text: 'POS N4030W07400,1234Z,FL350',
        label: '5Z'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.position.altitude).toBe('FL350');
    });
  });

  describe('enrichMessage - CPDLC detection', () => {
    it('should detect altitude request', () => {
      const message = {
        text: 'REQUEST FL350',
        label: 'B6'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.category).toBe('cpdlc');
      expect(enriched.cpdlc_type).toBe('request');
    });

    it('should detect clearance messages', () => {
      const message = {
        text: 'CLEARED FL350',
        label: 'B6'
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.category).toBe('cpdlc');
      expect(enriched.cpdlc_type).toBe('clearance');
    });
  });

  describe('ADS-B normalization', () => {
    it('should normalize ADS-B messages from different sources', () => {
      const adsbMessage = {
        hex: 'A12345',
        position: {
          lat: 40.7128,
          lon: -74.0060,
          altitude: 35000
        },
        ground_speed: 450,
        heading: 90,
        source_type: 'adsb'
      };

      const processed = messageProcessor.process(adsbMessage);

      expect(processed.source_type).toBe('adsb');
      expect(processed.category).toBe('adsb');
      expect(mockAircraftTracker.updateAircraft).toHaveBeenCalledWith(
        expect.objectContaining({
          hex: 'A12345',
          position: expect.objectContaining({
            lat: 40.7128,
            lon: -74.0060
          })
        })
      );
    });

    it('should not save ADS-B messages to database', () => {
      const adsbMessage = {
        hex: 'A12345',
        position: { lat: 40.7128, lon: -74.0060, altitude: 35000 },
        source_type: 'adsb'
      };

      messageProcessor.process(adsbMessage);

      expect(mockDatabase.saveMessage).not.toHaveBeenCalled();
    });

    it('should update aircraft tracker for ADS-B messages', () => {
      const adsbMessage = {
        hex: 'A12345',
        tail: 'N12345',
        flight: 'UAL123',
        position: { lat: 40.7128, lon: -74.0060, altitude: 35000 },
        ground_speed: 450,
        heading: 90,
        source_type: 'adsb',
        timestamp: '2024-01-01T12:00:00Z'
      };

      messageProcessor.process(adsbMessage);

      expect(mockAircraftTracker.updateAircraft).toHaveBeenCalledWith(
        expect.objectContaining({
          hex: 'A12345',
          tail: 'N12345',
          flight: 'UAL123',
          ground_speed: 450,
          heading: 90
        })
      );
    });
  });

  describe('HFGCS detection', () => {
    it('should detect SKYKING messages', () => {
      const message = {
        text: 'SKYKING SKYKING DO NOT ANSWER',
        frequency: 11175000
      };

      const enriched = messageProcessor.enrichMessage(message);

      expect(enriched.category).toBe('hfgcs');
      expect(enriched.hfgcs_type).toBe('skyking');
    });

    it('should detect EAM patterns', () => {
      const message = {
        text: 'ALPHA BRAVO CHARLIE DELTA ECHO',
        frequency: 8992000
      };

      const enriched = messageProcessor.enrichMessage(message);

      // Should be categorized as HFGCS if on HFGCS frequency
      expect(enriched.category).toBe('hfgcs');
    });
  });

  describe('Statistics tracking', () => {
    it('should increment total message count', () => {
      const message = { text: 'TEST', label: 'XX' };

      messageProcessor.process(message);

      expect(messageProcessor.stats.total).toBe(1);
      expect(messageProcessor.messageCount).toBe(1);
    });

    it('should track messages by type', () => {
      const messages = [
        { text: 'OUT 1234', label: 'H1' },
        { text: 'OFF 1235', label: 'H1' },
        { text: 'POS N4030W07400', label: '5Z' }
      ];

      messages.forEach(msg => messageProcessor.process(msg));

      expect(messageProcessor.stats.byType.oooi).toBe(2);
      expect(messageProcessor.stats.byType.position).toBe(1);
    });

    it('should track messages by airline', () => {
      const message = {
        text: 'TEST',
        airline: 'UAL',
        label: 'XX'
      };

      messageProcessor.process(message);

      expect(messageProcessor.stats.byAirline.UAL).toBe(1);
    });

    it('should track validation errors', () => {
      mockValidator.validateACARSMessage.mockReturnValue({
        valid: false,
        errors: ['Invalid format']
      });

      const message = { text: 'INVALID', label: 'XX' };

      messageProcessor.process(message);

      expect(messageProcessor.stats.errors).toBe(1);
    });
  });

  describe('Message processing pipeline', () => {
    it('should validate non-ADS-B messages', () => {
      const message = { text: 'TEST', label: 'XX' };

      messageProcessor.process(message);

      expect(mockValidator.validateACARSMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'TEST',
          label: 'XX'
        })
      );
    });

    it('should skip validation for ADS-B messages', () => {
      const message = {
        source_type: 'adsb',
        position: { lat: 40.7128, lon: -74.0060, altitude: 35000 }
      };

      messageProcessor.process(message);

      expect(mockValidator.validateACARSMessage).not.toHaveBeenCalled();
    });

    it('should save non-ADS-B messages to database', () => {
      const message = { text: 'TEST', label: 'XX' };

      messageProcessor.process(message);

      expect(mockDatabase.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'TEST',
          label: 'XX',
          validation: expect.objectContaining({
            valid: true
          })
        })
      );
    });

    it('should emit processed messages', (done) => {
      const message = { text: 'TEST', label: 'XX' };

      messageProcessor.on('message', (processedMessage) => {
        expect(processedMessage.text).toBe('TEST');
        expect(processedMessage.validation).toBeDefined();
        expect(processedMessage.processed_at).toBeDefined();
        done();
      });

      messageProcessor.process(message);
    });

    it('should handle processing errors gracefully', () => {
      mockDatabase.saveMessage.mockImplementation(() => {
        throw new Error('Database error');
      });

      const message = { text: 'TEST', label: 'XX' };

      const result = messageProcessor.process(message);

      expect(result).toBeNull();
      expect(messageProcessor.stats.errors).toBe(1);
    });
  });

  describe('Message enrichment', () => {
    it('should add message number to all messages', () => {
      const message1 = { text: 'TEST1', label: 'XX' };
      const message2 = { text: 'TEST2', label: 'XX' };

      const processed1 = messageProcessor.process(message1);
      const processed2 = messageProcessor.process(message2);

      expect(processed1.message_number).toBe(1);
      expect(processed2.message_number).toBe(2);
    });

    it('should add processed_at timestamp', () => {
      const message = { text: 'TEST', label: 'XX' };

      const processed = messageProcessor.process(message);

      expect(processed.processed_at).toBeDefined();
      expect(new Date(processed.processed_at)).toBeInstanceOf(Date);
    });

    it('should preserve original message data', () => {
      const message = {
        id: 'msg123',
        text: 'TEST',
        label: 'XX',
        flight: 'UAL123',
        tail: 'N12345'
      };

      const processed = messageProcessor.process(message);

      expect(processed.id).toBe('msg123');
      expect(processed.text).toBe('TEST');
      expect(processed.label).toBe('XX');
      expect(processed.flight).toBe('UAL123');
      expect(processed.tail).toBe('N12345');
    });
  });
});




