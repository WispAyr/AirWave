const BaseADSBSource = require('../../services/base-adsb-source');

describe('BaseADSBSource', () => {
  let source;

  beforeEach(() => {
    source = new BaseADSBSource({ poll_interval: 5000 });
  });

  afterEach(() => {
    source.disconnect();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(source.connected).toBe(false);
      expect(source.pollInterval).toBe(null);
      expect(source.updateInterval).toBe(5000);
      expect(source.trackedAircraft).toBeInstanceOf(Map);
    });

    test('should use default poll interval if not provided', () => {
      const defaultSource = new BaseADSBSource();
      expect(defaultSource.updateInterval).toBe(10000);
    });
  });

  describe('formatCoordinates', () => {
    test('should format positive coordinates correctly', () => {
      const result = source.formatCoordinates(51.5074, -0.1278);
      expect(result).toBe('N5130W00007');
    });

    test('should format negative coordinates correctly', () => {
      const result = source.formatCoordinates(-33.8688, 151.2093);
      expect(result).toBe('S3352E15112');
    });

    test('should handle zero coordinates', () => {
      const result = source.formatCoordinates(0, 0);
      expect(result).toBe('N0000E00000');
    });

    test('should pad numbers correctly', () => {
      const result = source.formatCoordinates(5.5, 10.5);
      expect(result).toBe('N0530E01030');
    });
  });

  describe('generatePositionText', () => {
    test('should generate position text with all parameters', () => {
      const result = source.generatePositionText('TEST123', 51.5074, -0.1278, 35000);
      expect(result).toMatch(/^POS N5130W00007,\d{6},350$/);
    });

    test('should handle missing callsign', () => {
      const result = source.generatePositionText(null, 51.5074, -0.1278, 35000);
      expect(result).toMatch(/^POS N5130W00007,\d{6},350$/);
    });

    test('should handle missing altitude', () => {
      const result = source.generatePositionText('TEST123', 51.5074, -0.1278, null);
      expect(result).toMatch(/^POS N5130W00007,\d{6},000$/);
    });
  });

  describe('determineFlightPhase', () => {
    test('should return TAXI when on ground', () => {
      expect(source.determineFlightPhase(true, 0, 0)).toBe('TAXI');
    });

    test('should return TAXI when altitude is very low', () => {
      expect(source.determineFlightPhase(false, 50, 0)).toBe('TAXI');
    });

    test('should return TAKEOFF when climbing rapidly', () => {
      expect(source.determineFlightPhase(false, 5000, 1500)).toBe('TAKEOFF');
    });

    test('should return DESCENT when descending rapidly', () => {
      expect(source.determineFlightPhase(false, 20000, -1000)).toBe('DESCENT');
    });

    test('should return APPROACH when low altitude and stable', () => {
      expect(source.determineFlightPhase(false, 5000, 100)).toBe('APPROACH');
    });

    test('should return CRUISE when high altitude and stable', () => {
      expect(source.determineFlightPhase(false, 35000, 0)).toBe('CRUISE');
    });

    test('should return UNKNOWN when altitude is missing', () => {
      expect(source.determineFlightPhase(false, null, 0)).toBe('UNKNOWN');
    });
  });

  describe('hasSignificantChange', () => {
    const createMessage = (lat, lon, alt, velocity, heading, phase) => ({
      position: { lat, lon, altitude: alt },
      velocity,
      heading,
      flight_phase: phase
    });

    test('should return true for new aircraft (no old message)', () => {
      const newMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      expect(source.hasSignificantChange(null, newMessage)).toBe(true);
    });

    test('should detect significant position change', () => {
      const oldMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      const newMessage = createMessage(51.502, -0.102, 35000, 450, 180, 'CRUISE');
      expect(source.hasSignificantChange(oldMessage, newMessage)).toBe(true);
    });

    test('should detect significant altitude change', () => {
      const oldMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      const newMessage = createMessage(51.5, -0.1, 36500, 450, 180, 'CRUISE');
      expect(source.hasSignificantChange(oldMessage, newMessage)).toBe(true);
    });

    test('should detect significant speed change', () => {
      const oldMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      const newMessage = createMessage(51.5, -0.1, 35000, 510, 180, 'CRUISE');
      expect(source.hasSignificantChange(oldMessage, newMessage)).toBe(true);
    });

    test('should detect significant heading change', () => {
      const oldMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      const newMessage = createMessage(51.5, -0.1, 35000, 450, 220, 'CRUISE');
      expect(source.hasSignificantChange(oldMessage, newMessage)).toBe(true);
    });

    test('should detect flight phase change', () => {
      const oldMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      const newMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'DESCENT');
      expect(source.hasSignificantChange(oldMessage, newMessage)).toBe(true);
    });

    test('should return false for insignificant changes', () => {
      const oldMessage = createMessage(51.5, -0.1, 35000, 450, 180, 'CRUISE');
      const newMessage = createMessage(51.5001, -0.1001, 35100, 455, 182, 'CRUISE');
      expect(source.hasSignificantChange(oldMessage, newMessage)).toBe(false);
    });
  });

  describe('abstract methods', () => {
    test('fetchData should throw error if not implemented', async () => {
      await expect(source.fetchData()).rejects.toThrow('fetchData() must be implemented by subclass');
    });

    test('processData should throw error if not implemented', () => {
      expect(() => source.processData({})).toThrow('processData() must be implemented by subclass');
    });
  });

  describe('connection management', () => {
    test('should report disconnected initially', () => {
      expect(source.isConnected()).toBe(false);
    });

    test('should return correct stats', () => {
      const stats = source.getStats();
      expect(stats).toHaveProperty('connected', false);
      expect(stats).toHaveProperty('tracked_aircraft', 0);
      expect(stats).toHaveProperty('last_update', null);
      expect(stats).toHaveProperty('update_interval', 5000);
    });

    test('should update poll interval', () => {
      source.setPollInterval(15000);
      expect(source.updateInterval).toBe(15000);
    });
  });
});

