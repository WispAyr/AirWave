const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const path = require('path');
const fs = require('fs');

class VideoRenderer {
  constructor(database) {
    this.database = database;
    this.outputDir = path.join(__dirname, '../data/videos');
    this.bundleCache = null; // Will store path to cached bundle
    this.bundleCacheTime = null; // Track when bundle was created
    this.bundleCacheTTL = 60 * 60 * 1000; // 1 hour TTL for bundle cache
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Add .gitignore to videos directory
    const gitignorePath = path.join(this.outputDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '# Ignore all video files\n*.mp4\n*.mov\n*.avi\n');
    }

    // Schedule periodic cleanup
    this.scheduleCleanup();
  }

  /**
   * Generate a video for an aircraft track
   * @param {string} aircraftId - Aircraft identifier (flight, tail, hex, or aircraft_id)
   * @param {object} options - Video generation options
   * @returns {Promise<object>} Video metadata (path, duration, size)
   */
  async generateAircraftVideo(aircraftId, options = {}) {
    const startTime = Date.now();
    console.log(`📹 Starting video generation for aircraft: ${aircraftId}`);

    try {
      // Fetch aircraft data from database
      const aircraft = this.database.getAircraftByIdentifier(aircraftId);
      
      if (!aircraft) {
        throw new Error(`Aircraft not found: ${aircraftId}`);
      }

      const trackPoints = aircraft.track_points || [];
      
      if (trackPoints.length < 2) {
        throw new Error(`Insufficient track data: ${trackPoints.length} points (minimum 2 required)`);
      }

      console.log(`   Found ${trackPoints.length} track points`);

      // Get local photos for the aircraft
      const photos = this.database.getLocalPhotosForAircraft(aircraftId);
      console.log(`   Found ${photos.length} local photos`);

      // Calculate altitude profile
      const altitudeProfile = this.calculateAltitudeProfile(trackPoints);
      
      // Determine flight status
      const flightStatus = this.determineFlightStatus(aircraft, trackPoints);

      // Prepare composition input props
      const inputProps = {
        flight: aircraft.flight || aircraft.tail || aircraft.hex || 'N/A',
        tail: aircraft.tail || 'N/A',
        type: aircraft.aircraft_type || 'Unknown',
        trackPoints: trackPoints.map(point => ({
          lat: point.lat,
          lon: point.lon,
          altitude: point.altitude || 0,
          speed: point.speed || 0,
          heading: point.heading || 0,
          timestamp: new Date(point.timestamp).getTime(),
        })),
        photos: photos.map(photo => ({
          path: photo.local_path,
          photographer: photo.photographer,
          aircraftType: photo.aircraft_type,
          source: photo.source
        })),
        altitudeProfile: altitudeProfile,
        flightStatus: flightStatus,
        theme: options.theme || {
          primaryColor: '#00d8ff',
          secondaryColor: '#00ff88',
          backgroundColor: '#0a0e27',
          accentColor: '#ff6b6b'
        },
        durationSeconds: options.durationSeconds || 15, // Increased for more content
      };

      // Use cached bundle or create new one
      let bundleLocation;
      const now = Date.now();
      const cacheValid = this.bundleCache && this.bundleCacheTime && (now - this.bundleCacheTime < this.bundleCacheTTL);
      
      if (cacheValid && fs.existsSync(this.bundleCache)) {
        console.log('   Using cached bundle:', this.bundleCache);
        bundleLocation = this.bundleCache;
      } else {
        console.log('   Bundling Remotion project...');
        const remotionRoot = path.join(__dirname, '../../remotion/index.ts');
        
        try {
          bundleLocation = await bundle({
            entryPoint: remotionRoot,
            onProgress: (progress) => {
              if (progress % 25 === 0) {
                console.log(`   Bundling progress: ${progress}%`);
              }
            },
          });
          console.log('   ✅ Bundle created at:', bundleLocation);
          
          // Cache the bundle location
          this.bundleCache = bundleLocation;
          this.bundleCacheTime = now;
        } catch (bundleError) {
          console.error('   ❌ Bundling failed:', bundleError);
          console.error('   Entry point:', remotionRoot);
          throw new Error(`Failed to bundle Remotion project: ${bundleError.message}`);
        }
      }

      // Select composition
      const compositionId = 'AircraftTrackVideo';
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps,
      });

      console.log(`   Composition: ${composition.width}x${composition.height} @ ${composition.fps}fps`);

      // Generate output filename
      const sanitizedId = aircraftId.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();
      const outputPath = path.join(this.outputDir, `${sanitizedId}_${timestamp}.mp4`);

      // Render video
      console.log('   Rendering video...');
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
          const percent = (progress * 100).toFixed(1);
          if (renderedFrames % 30 === 0) {
            console.log(`   Progress: ${percent}% (${renderedFrames} frames rendered, ${encodedFrames} encoded)`);
          }
        },
      });

      // Get file stats
      const stats = fs.statSync(outputPath);
      const duration = composition.durationInFrames / composition.fps;
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`✅ Video generated successfully in ${elapsedTime}s`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Duration: ${duration.toFixed(2)}s`);

      return {
        success: true,
        videoPath: outputPath,
        relativePath: path.relative(path.join(__dirname, '../data'), outputPath),
        duration,
        size: stats.size,
        frames: composition.durationInFrames,
        fps: composition.fps,
        resolution: `${composition.width}x${composition.height}`,
        aircraftData: {
          flight: inputProps.flight,
          tail: inputProps.tail,
          type: inputProps.type,
          trackPointCount: trackPoints.length,
        },
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Video generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if a video exists for an aircraft
   * @param {string} aircraftId - Aircraft identifier
   * @returns {object|null} Video metadata if exists
   */
  getVideoForAircraft(aircraftId) {
    try {
      const sanitizedId = aircraftId.replace(/[^a-zA-Z0-9]/g, '_');
      const files = fs.readdirSync(this.outputDir);
      
      // Find the most recent video for this aircraft
      const videoFiles = files
        .filter(file => file.startsWith(sanitizedId) && file.endsWith('.mp4'))
        .map(file => {
          const filePath = path.join(this.outputDir, file);
          const stats = fs.statSync(filePath);
          return {
            path: filePath,
            relativePath: path.relative(path.join(__dirname, '../data'), filePath),
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      return videoFiles.length > 0 ? videoFiles[0] : null;
    } catch (error) {
      console.error('Error checking for video:', error);
      return null;
    }
  }

  /**
   * Delete old video files (cleanup)
   * @param {number} maxAgeHours - Maximum age in hours (default 24)
   */
  cleanupOldVideos(maxAgeHours = 24) {
    try {
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      const files = fs.readdirSync(this.outputDir);
      
      let deletedCount = 0;
      
      files.forEach(file => {
        if (file === '.gitignore') return;
        
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️  Deleted old video: ${file}`);
        }
      });

      if (deletedCount > 0) {
        console.log(`✅ Cleanup complete: ${deletedCount} video(s) deleted`);
      }
    } catch (error) {
      console.error('Error during video cleanup:', error);
    }
  }

  /**
   * Calculate altitude profile from track points
   */
  calculateAltitudeProfile(trackPoints) {
    if (!trackPoints || trackPoints.length === 0) {
      return { min: 0, max: 0, points: [] };
    }

    const altitudes = trackPoints.map(p => parseInt(p.altitude) || 0);
    const times = trackPoints.map(p => new Date(p.timestamp).getTime());
    
    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    const avg = altitudes.reduce((a, b) => a + b, 0) / altitudes.length;

    // Sample points for chart (max 50 points for smooth rendering)
    const sampleSize = Math.min(trackPoints.length, 50);
    const step = Math.floor(trackPoints.length / sampleSize);
    
    const points = [];
    for (let i = 0; i < trackPoints.length; i += step) {
      const point = trackPoints[i];
      points.push({
        time: new Date(point.timestamp).getTime(),
        altitude: parseInt(point.altitude) || 0,
        speed: point.speed || 0
      });
    }

    return {
      min: Math.round(min),
      max: Math.round(max),
      avg: Math.round(avg),
      points: points
    };
  }

  /**
   * Determine flight status from aircraft data
   */
  determineFlightStatus(aircraft, trackPoints) {
    if (!trackPoints || trackPoints.length === 0) {
      return {
        phase: 'UNKNOWN',
        description: 'Flight tracking in progress'
      };
    }

    const firstPoint = trackPoints[0];
    const lastPoint = trackPoints[trackPoints.length - 1];
    const currentAlt = parseInt(lastPoint.altitude) || 0;
    const altChange = currentAlt - (parseInt(firstPoint.altitude) || 0);
    const lastSpeed = lastPoint.speed || 0;

    let phase = 'UNKNOWN';
    let description = '';

    if (currentAlt < 100 && lastSpeed < 50) {
      phase = 'TAXI';
      description = 'Aircraft on ground';
    } else if (altChange > 1000 && currentAlt < 20000) {
      phase = 'TAKEOFF';
      description = 'Climbing after departure';
    } else if (currentAlt >= 20000 && Math.abs(altChange) < 2000) {
      phase = 'CRUISE';
      description = `Cruising at FL${Math.round(currentAlt / 100)}`;
    } else if (altChange < -1000 && currentAlt < 20000) {
      phase = 'DESCENT';
      description = 'Descending for arrival';
    } else if (currentAlt < 5000 && lastSpeed < 200) {
      phase = 'APPROACH';
      description = 'On approach';
    } else if (currentAlt < 100 && lastSpeed < 10) {
      phase = 'LANDED';
      description = 'Aircraft has landed';
    } else {
      phase = 'EN_ROUTE';
      description = `FL${Math.round(currentAlt / 100)} - ${Math.round(lastSpeed)} kts`;
    }

    return {
      phase: phase,
      description: description,
      altitude: currentAlt,
      speed: Math.round(lastSpeed),
      trackLength: trackPoints.length,
      duration: new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp)
    };
  }

  /**
   * Schedule periodic cleanup of old videos
   */
  scheduleCleanup() {
    // Run cleanup every 6 hours
    const cleanupInterval = 6 * 60 * 60 * 1000;
    
    setInterval(() => {
      console.log('🧹 Running scheduled video cleanup...');
      this.cleanupOldVideos(24);
    }, cleanupInterval);

    // Run initial cleanup on startup
    setTimeout(() => {
      this.cleanupOldVideos(24);
    }, 5000);
  }

  /**
   * Get renderer status and statistics
   */
  getStatus() {
    try {
      const files = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.mp4'));
      const totalSize = files.reduce((sum, file) => {
        const stats = fs.statSync(path.join(this.outputDir, file));
        return sum + stats.size;
      }, 0);

      return {
        videosCount: files.length,
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        bundled: !!this.bundleCache,
        outputDir: this.outputDir,
      };
    } catch (error) {
      console.error('Error getting renderer status:', error);
      return { error: error.message };
    }
  }
}

module.exports = VideoRenderer;

