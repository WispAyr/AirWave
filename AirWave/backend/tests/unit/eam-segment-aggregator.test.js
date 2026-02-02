const EAMSegmentAggregator = require('../../services/eam-segment-aggregator');

// Mock database
const createMockDatabase = () => {
  return {
    getRecordingsInTimeWindow: jest.fn((feedId, timestamp, window) => {
      // Return mock segments
      return [
        { 
          segment_id: 'seg1', 
          transcription_text: 'Alpha Bravo Charlie', 
          start_time: '2025-10-26T19:32:49Z',
          feed_id: feedId
        },
        { 
          segment_id: 'seg2', 
          transcription_text: 'Delta Echo Foxtrot', 
          start_time: '2025-10-26T19:33:05Z',
          feed_id: feedId
        },
        { 
          segment_id: 'seg3', 
          transcription_text: 'Golf Hotel India', 
          start_time: '2025-10-26T19:33:21Z',
          feed_id: feedId
        }
      ];
    })
  };
};

describe('EAMSegmentAggregator', () => {
  let aggregator;
  let mockDatabase;
  
  beforeEach(() => {
    mockDatabase = createMockDatabase();
    aggregator = new EAMSegmentAggregator(mockDatabase);
  });
  
  describe('getRelatedSegments', () => {
    test('should fetch segments within time window', async () => {
      const segments = await aggregator.getRelatedSegments(
        'seg1', 
        'hfgcs-primary', 
        '2025-10-26T19:33:00Z'
      );
      
      expect(mockDatabase.getRecordingsInTimeWindow).toHaveBeenCalledWith(
        'hfgcs-primary',
        '2025-10-26T19:33:00Z',
        120
      );
      expect(segments.length).toBe(3);
    });

    test('should limit to max segments', async () => {
      // Mock database to return 15 segments
      mockDatabase.getRecordingsInTimeWindow.mockReturnValue(
        Array(15).fill(null).map((_, i) => ({
          segment_id: `seg${i}`,
          transcription_text: 'Test',
          start_time: '2025-10-26T19:33:00Z'
        }))
      );

      const segments = await aggregator.getRelatedSegments(
        'seg1',
        'hfgcs-primary',
        '2025-10-26T19:33:00Z'
      );

      expect(segments.length).toBe(10); // Max limit
    });

    test('should handle database errors gracefully', async () => {
      mockDatabase.getRecordingsInTimeWindow.mockImplementation(() => {
        throw new Error('Database error');
      });

      const segments = await aggregator.getRelatedSegments(
        'seg1',
        'hfgcs-primary',
        '2025-10-26T19:33:00Z'
      );

      expect(segments).toEqual([]);
    });
  });
  
  describe('aggregateTranscriptions', () => {
    test('should combine 2 segments correctly', () => {
      const segments = [
        { 
          segment_id: 'seg1', 
          transcription_text: 'Alpha Bravo', 
          start_time: '2025-10-26T19:32:49Z' 
        },
        { 
          segment_id: 'seg2', 
          transcription_text: 'Charlie Delta', 
          start_time: '2025-10-26T19:33:05Z' 
        }
      ];

      const result = aggregator.aggregateTranscriptions(segments);

      expect(result.combinedText).toBe('Alpha Bravo Charlie Delta');
      expect(result.segmentIds).toEqual(['seg1', 'seg2']);
      expect(result.segmentCount).toBe(2);
    });

    test('should sort segments by timestamp chronologically', () => {
      const segments = [
        { 
          segment_id: 'seg3', 
          transcription_text: 'Golf', 
          start_time: '2025-10-26T19:33:21Z' 
        },
        { 
          segment_id: 'seg1', 
          transcription_text: 'Alpha', 
          start_time: '2025-10-26T19:32:49Z' 
        },
        { 
          segment_id: 'seg2', 
          transcription_text: 'Delta', 
          start_time: '2025-10-26T19:33:05Z' 
        }
      ];

      const result = aggregator.aggregateTranscriptions(segments);

      expect(result.combinedText).toBe('Alpha Delta Golf');
      expect(result.segmentIds).toEqual(['seg1', 'seg2', 'seg3']);
    });

    test('should track all segment IDs', () => {
      const segments = [
        { segment_id: 'seg1', transcription_text: 'A', start_time: '2025-10-26T19:32:49Z' },
        { segment_id: 'seg2', transcription_text: 'B', start_time: '2025-10-26T19:33:05Z' },
        { segment_id: 'seg3', transcription_text: 'C', start_time: '2025-10-26T19:33:21Z' }
      ];

      const result = aggregator.aggregateTranscriptions(segments);

      expect(result.segmentIds).toEqual(['seg1', 'seg2', 'seg3']);
    });

    test('should calculate duration span correctly', () => {
      const segments = [
        { 
          segment_id: 'seg1', 
          transcription_text: 'Alpha', 
          start_time: '2025-10-26T19:32:49Z' 
        },
        { 
          segment_id: 'seg2', 
          transcription_text: 'Bravo', 
          start_time: '2025-10-26T19:33:21Z' // 32 seconds later
        }
      ];

      const result = aggregator.aggregateTranscriptions(segments);

      expect(result.durationSeconds).toBe(32);
      expect(result.firstTimestamp).toBe('2025-10-26T19:32:49Z');
      expect(result.lastTimestamp).toBe('2025-10-26T19:33:21Z');
    });

    test('should handle empty array', () => {
      const result = aggregator.aggregateTranscriptions([]);

      expect(result.combinedText).toBe('');
      expect(result.segmentIds).toEqual([]);
      expect(result.segmentCount).toBe(0);
    });

    test('should filter out empty transcriptions', () => {
      const segments = [
        { segment_id: 'seg1', transcription_text: 'Alpha', start_time: '2025-10-26T19:32:49Z' },
        { segment_id: 'seg2', transcription_text: '', start_time: '2025-10-26T19:33:05Z' },
        { segment_id: 'seg3', transcription_text: 'Bravo', start_time: '2025-10-26T19:33:21Z' }
      ];

      const result = aggregator.aggregateTranscriptions(segments);

      expect(result.combinedText).toBe('Alpha Bravo');
    });
  });
  
  describe('shouldTriggerAggregation', () => {
    test('should trigger on "stand by"', () => {
      const result = aggregator.shouldTriggerAggregation('PLEASE STAND BY FOR MESSAGE');
      expect(result).toBe(true);
    });

    test('should trigger on "message follows"', () => {
      const result = aggregator.shouldTriggerAggregation('MESSAGE FOLLOWS ALPHA BRAVO');
      expect(result).toBe(true);
    });

    test('should trigger on "I say again"', () => {
      const result = aggregator.shouldTriggerAggregation('ALPHA BRAVO I SAY AGAIN');
      expect(result).toBe(true);
    });

    test('should trigger on "authentication"', () => {
      const result = aggregator.shouldTriggerAggregation('AUTHENTICATION ALPHA BRAVO');
      expect(result).toBe(true);
    });

    test('should trigger on "skyking"', () => {
      const result = aggregator.shouldTriggerAggregation('SKYKING SKYKING DO NOT ANSWER');
      expect(result).toBe(true);
    });

    test('should trigger on 15+ NATO phonetics', () => {
      const result = aggregator.shouldTriggerAggregation(
        'ALPHA BRAVO CHARLIE DELTA ECHO FOXTROT GOLF HOTEL INDIA JULIET KILO LIMA MIKE NOVEMBER OSCAR PAPA'
      );
      expect(result).toBe(true);
    });

    test('should not trigger on normal ATC communication', () => {
      const result = aggregator.shouldTriggerAggregation('CONTINUE PRESENT HEADING');
      expect(result).toBe(false);
    });

    test('should not trigger on empty text', () => {
      const result = aggregator.shouldTriggerAggregation('');
      expect(result).toBe(false);
    });

    test('should not trigger on null', () => {
      const result = aggregator.shouldTriggerAggregation(null);
      expect(result).toBe(false);
    });
  });
  
  describe('buildSlidingWindows', () => {
    test('should create overlapping windows of 3 segments', () => {
      const segments = [
        { segment_id: 'seg1', transcription_text: 'A', start_time: '2025-10-26T19:32:49Z' },
        { segment_id: 'seg2', transcription_text: 'B', start_time: '2025-10-26T19:33:05Z' },
        { segment_id: 'seg3', transcription_text: 'C', start_time: '2025-10-26T19:33:21Z' },
        { segment_id: 'seg4', transcription_text: 'D', start_time: '2025-10-26T19:33:37Z' },
        { segment_id: 'seg5', transcription_text: 'E', start_time: '2025-10-26T19:33:53Z' }
      ];

      const windows = aggregator.buildSlidingWindows(segments, 3);

      expect(windows.length).toBe(3); // 5 segments with window of 3 = 3 windows
      expect(windows[0].combinedText).toBe('A B C');
      expect(windows[1].combinedText).toBe('B C D');
      expect(windows[2].combinedText).toBe('C D E');
    });

    test('should handle fewer segments than window size', () => {
      const segments = [
        { segment_id: 'seg1', transcription_text: 'A', start_time: '2025-10-26T19:32:49Z' },
        { segment_id: 'seg2', transcription_text: 'B', start_time: '2025-10-26T19:33:05Z' }
      ];

      const windows = aggregator.buildSlidingWindows(segments, 3);

      expect(windows.length).toBe(1);
      expect(windows[0].combinedText).toBe('A B');
    });

    test('should handle empty segments', () => {
      const windows = aggregator.buildSlidingWindows([], 3);

      expect(windows.length).toBe(1);
      expect(windows[0].combinedText).toBe('');
    });
  });

  describe('markSegmentsProcessed', () => {
    test('should mark segments as processed', () => {
      aggregator.markSegmentsProcessed(['seg1', 'seg2', 'seg3'], 'eam-123');

      expect(aggregator.isProcessed(['seg1', 'seg2', 'seg3'])).toBe(true);
    });

    test('should handle different order of segment IDs', () => {
      aggregator.markSegmentsProcessed(['seg1', 'seg2', 'seg3'], 'eam-123');

      // Should match regardless of order
      expect(aggregator.isProcessed(['seg3', 'seg1', 'seg2'])).toBe(true);
    });

    test('should not match different segment combinations', () => {
      aggregator.markSegmentsProcessed(['seg1', 'seg2', 'seg3'], 'eam-123');

      expect(aggregator.isProcessed(['seg1', 'seg2', 'seg4'])).toBe(false);
    });

    test('should handle empty array', () => {
      aggregator.markSegmentsProcessed([], 'eam-123');

      expect(aggregator.isProcessed([])).toBe(false);
    });
  });

  describe('cache management', () => {
    test('should clean expired entries', () => {
      jest.useFakeTimers();
      
      aggregator.markSegmentsProcessed(['seg1', 'seg2'], 'eam-123');
      
      // Fast forward 11 minutes (past TTL)
      jest.advanceTimersByTime(11 * 60 * 1000);
      
      aggregator.cleanCache();
      
      expect(aggregator.isProcessed(['seg1', 'seg2'])).toBe(false);
      
      jest.useRealTimers();
    });

    test('should return cache stats', () => {
      aggregator.markSegmentsProcessed(['seg1', 'seg2'], 'eam-123');
      aggregator.markSegmentsProcessed(['seg3', 'seg4'], 'eam-456');

      const stats = aggregator.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.ttl).toBe(600000); // 10 minutes
    });
  });
});

