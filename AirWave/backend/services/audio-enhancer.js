/**
 * Audio enhancement for VHF AM radio signals
 * Improves transcription accuracy by preprocessing aviation radio audio
 */
class AudioEnhancer {
  constructor() {
    // VHF AM radio characteristics
    this.vhfBandwidth = { low: 300, high: 3000 }; // VHF voice bandwidth
    this.sampleRate = 16000; // Whisper requires 16kHz
  }

  /**
   * Get FFmpeg audio filters optimized for VHF AM radio
   * @returns {string} FFmpeg filter chain
   */
  getVHFFilters() {
    const filters = [];

    // 1. High-pass filter to remove low-frequency hum (below 300 Hz)
    // VHF radios don't transmit below ~300 Hz
    filters.push('highpass=f=300');

    // 2. Low-pass filter to remove high-frequency noise (above 3000 Hz)
    // VHF AM voice bandwidth is 300-3000 Hz
    filters.push('lowpass=f=3000');

    // 3. Noise reduction for radio static
    // Remove background hiss common in aviation radio
    filters.push('afftdn=nf=-20');

    // 4. Compressor to even out volume levels
    // Helps with varying signal strength
    filters.push('acompressor=threshold=0.125:ratio=9:attack=0.1:release=0.2');

    // 5. Normalize audio levels
    // Ensures consistent volume for Whisper
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');

    // 6. Gate to remove very quiet noise between transmissions
    // Only let through audio above threshold
    filters.push('agate=threshold=0.001:ratio=2:attack=0.01:release=0.1');

    return filters.join(',');
  }

  /**
   * Get enhanced FFmpeg command for aviation radio
   * @param {Object} ffmpegCommand - Existing FFmpeg command
   * @returns {Object} Enhanced FFmpeg command
   */
  enhanceForAviationRadio(ffmpegCommand) {
    return ffmpegCommand
      .audioFilters(this.getVHFFilters())
      .audioBitrate('128k')
      .audioQuality(0); // Highest quality
  }

  /**
   * Alternative: Simple enhancement for lower CPU usage
   */
  getSimpleVHFFilters() {
    return [
      'highpass=f=300',      // Remove low rumble
      'lowpass=f=3000',      // Remove high hiss
      'loudnorm=I=-16'       // Normalize volume
    ].join(',');
  }

  /**
   * Get filters for noise reduction only
   */
  getNoiseReductionFilters() {
    return [
      'afftdn=nf=-20',       // FFT-based noise reduction
      'highpass=f=200',      // Remove rumble
      'agate=threshold=0.002' // Remove quiet noise
    ].join(',');
  }

  /**
   * Analyze audio characteristics
   * Returns metadata about the audio stream
   */
  async analyzeAudio(audioBuffer) {
    // This could be expanded to detect:
    // - Stereo vs mono
    // - Sample rate
    // - Noise levels
    // - Speech probability
    return {
      size: audioBuffer.length,
      estimated_duration: audioBuffer.length / (this.sampleRate * 2),
      sample_rate: this.sampleRate
    };
  }
}

module.exports = AudioEnhancer;

