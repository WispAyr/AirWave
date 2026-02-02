const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Photo Downloader Service
 * Downloads and stores aircraft photos locally for video generation
 */
class PhotoDownloader extends EventEmitter {
  constructor(database) {
    super();
    this.database = database;
    this.downloadDir = path.join(__dirname, '../data/photos');
    this.activeDownloads = new Map();
    this.maxConcurrent = 3;
    this.downloadQueue = [];
    
    // Ensure download directory exists
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
      console.log(`📁 Created photos directory: ${this.downloadDir}`);
    }

    // Add .gitignore
    const gitignorePath = path.join(this.downloadDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '# Ignore all downloaded photos\n*.jpg\n*.jpeg\n*.png\n*.webp\n');
    }
  }

  /**
   * Download a single photo
   * @param {string} url - Photo URL
   * @param {string} registration - Aircraft registration
   * @param {number} photoId - Database photo ID
   * @returns {Promise<string>} Local file path
   */
  async downloadPhoto(url, registration, photoId) {
    try {
      // Generate filename from URL hash to avoid duplicates
      const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const sanitizedReg = registration.replace(/[^a-zA-Z0-9-]/g, '_');
      const filename = `${sanitizedReg}_${urlHash}${ext}`;
      const filepath = path.join(this.downloadDir, filename);

      // Check if already downloaded
      if (fs.existsSync(filepath)) {
        console.log(`✅ Photo already exists: ${filename}`);
        await this.database.updatePhotoLocalPath(photoId, filepath, filename);
        return filepath;
      }

      console.log(`📥 Downloading photo: ${filename}`);

      // Download photo
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'AirWave-MissionControl/1.0'
        }
      });

      // Save to disk
      fs.writeFileSync(filepath, response.data);
      
      const stats = fs.statSync(filepath);
      console.log(`✅ Downloaded ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);

      // Update database with local path
      await this.database.updatePhotoLocalPath(photoId, filepath, filename);

      this.emit('photo_downloaded', {
        photoId,
        registration,
        filename,
        size: stats.size,
        url
      });

      return filepath;
    } catch (error) {
      console.error(`❌ Failed to download photo from ${url}:`, error.message);
      this.emit('download_failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Download all photos for an aircraft
   * @param {string} identifier - Aircraft identifier (hex/registration/flight)
   * @returns {Promise<Array>} Downloaded photo paths
   */
  async downloadPhotosForAircraft(identifier) {
    try {
      console.log(`📸 Downloading photos for aircraft: ${identifier}`);

      // Get photos from database
      const photos = this.database.getAircraftPhotos(identifier);
      
      if (photos.length === 0) {
        console.log(`⚠️  No photos found for ${identifier}`);
        return [];
      }

      const downloadedPaths = [];

      for (const photo of photos) {
        // Skip if already downloaded
        if (photo.local_path && fs.existsSync(photo.local_path)) {
          downloadedPaths.push(photo.local_path);
          continue;
        }

        try {
          const filepath = await this.downloadPhoto(
            photo.photo_url,
            photo.aircraft_tail,
            photo.id
          );
          downloadedPaths.push(filepath);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to download photo ${photo.id}:`, error.message);
        }
      }

      console.log(`✅ Downloaded ${downloadedPaths.length}/${photos.length} photos for ${identifier}`);
      
      return downloadedPaths;
    } catch (error) {
      console.error(`Error downloading photos for ${identifier}:`, error.message);
      throw error;
    }
  }

  /**
   * Background task to download photos for all aircraft with photos
   */
  async downloadAllPendingPhotos() {
    try {
      console.log('🔄 Starting background photo download...');

      const stats = this.database.getPhotoStats();
      const photosWithoutLocal = this.database.getPhotosWithoutLocalCopy();

      console.log(`   Found ${photosWithoutLocal.length} photos to download`);

      let downloaded = 0;
      let failed = 0;

      for (const photo of photosWithoutLocal) {
        try {
          await this.downloadPhoto(
            photo.photo_url,
            photo.aircraft_tail,
            photo.id
          );
          downloaded++;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          failed++;
        }
      }

      console.log(`✅ Background download complete: ${downloaded} success, ${failed} failed`);
      
      this.emit('batch_download_complete', { downloaded, failed });
      
      return { downloaded, failed };
    } catch (error) {
      console.error('Error in background photo download:', error);
      throw error;
    }
  }

  /**
   * Start background download job
   * @param {number} intervalMs - Interval in milliseconds
   */
  startBackgroundDownload(intervalMs = 15 * 60 * 1000) { // Every 15 minutes
    console.log(`🔄 Starting background photo download (every ${intervalMs / 1000 / 60} minutes)`);

    // Run immediately after a short delay
    setTimeout(() => {
      this.downloadAllPendingPhotos().catch(err => {
        console.error('Background download failed:', err);
      });
    }, 10000); // Wait 10 seconds after startup

    // Then run on interval
    this.downloadInterval = setInterval(() => {
      this.downloadAllPendingPhotos().catch(err => {
        console.error('Background download failed:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop background download job
   */
  stopBackgroundDownload() {
    if (this.downloadInterval) {
      clearInterval(this.downloadInterval);
      this.downloadInterval = null;
      console.log('🛑 Background photo download stopped');
    }
  }

  /**
   * Clean up old photos
   * @param {number} maxAgeDays - Maximum age in days
   */
  cleanupOldPhotos(maxAgeDays = 30) {
    try {
      const now = Date.now();
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(this.downloadDir);
      
      let deletedCount = 0;
      let deletedSize = 0;

      files.forEach(file => {
        if (file === '.gitignore') return;
        
        const filepath = path.join(this.downloadDir, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAge) {
          deletedSize += stats.size;
          fs.unlinkSync(filepath);
          deletedCount++;
          console.log(`🗑️  Deleted old photo: ${file}`);
        }
      });

      if (deletedCount > 0) {
        console.log(`✅ Cleanup: ${deletedCount} photos deleted (${(deletedSize / 1024 / 1024).toFixed(2)} MB freed)`);
      }

      return { deletedCount, deletedSize };
    } catch (error) {
      console.error('Error during photo cleanup:', error);
      return { deletedCount: 0, deletedSize: 0 };
    }
  }

  /**
   * Get download statistics
   */
  getStats() {
    try {
      const files = fs.readdirSync(this.downloadDir).filter(f => f !== '.gitignore');
      const totalSize = files.reduce((sum, file) => {
        const stats = fs.statSync(path.join(this.downloadDir, file));
        return sum + stats.size;
      }, 0);

      return {
        totalPhotos: files.length,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        downloadDir: this.downloadDir
      };
    } catch (error) {
      console.error('Error getting downloader stats:', error);
      return { totalPhotos: 0, totalSizeMB: 0 };
    }
  }
}

module.exports = PhotoDownloader;

