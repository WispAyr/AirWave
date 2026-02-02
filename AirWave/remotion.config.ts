import { Config } from '@remotion/cli/config';

// Configure video rendering settings for optimal performance and quality

// Use JPEG for better performance (vs PNG)
Config.setVideoImageFormat('jpeg');

// Overwrite output files if they exist
Config.setOverwriteOutput(true);

// Set concurrency to limit CPU usage (adjust based on your system)
Config.setConcurrency(2);

// Use H.264 codec for maximum compatibility
Config.setCodec('h264');

// Set quality (1-100, higher is better quality but larger file size)
// 80 is a good balance between quality and file size
Config.setJpegQuality(80);

// Enable logging for debugging
Config.setLogLevel('info');

// Set default props for Remotion Studio
Config.setDefaultProps({
  durationInFrames: 300,
  fps: 30,
  width: 1920,
  height: 1080,
});

// Optional: Set custom webpack configuration
// Config.overrideWebpackConfig((currentConfiguration) => {
//   return {
//     ...currentConfiguration,
//     // Your webpack overrides here
//   };
// });





