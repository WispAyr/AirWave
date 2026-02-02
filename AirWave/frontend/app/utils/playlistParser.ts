/**
 * Constructs the LiveATC playlist URL from mount point
 * @param mount - Mount point identifier (e.g., "kjfk_twr")
 * @returns Full playlist URL
 */
export function parsePlaylistUrl(mount: string): string {
  return `https://www.liveatc.net/play/${mount}.pls`
}

/**
 * Fetches and parses a .pls playlist file to extract the stream URL
 * Uses backend proxy to avoid CORS issues
 * @param mount - Mount point identifier
 * @returns Promise resolving to the stream URL
 */
export async function fetchAndParsePlaylist(mount: string): Promise<string> {
  if (!mount) {
    throw new Error('Mount point is required')
  }

  try {
    // Use our backend proxy to fetch the playlist (avoids CORS)
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/atc-playlist/${mount}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `Failed to fetch playlist: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.streamUrl) {
      throw new Error('No stream URL in response')
    }

    if (validateStreamUrl(data.streamUrl)) {
      return data.streamUrl
    } else {
      throw new Error('Invalid stream URL received from server')
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Playlist parsing error: ${error.message}`)
    }
    throw new Error('Unknown error occurred while parsing playlist')
  }
}

/**
 * Validates that a URL is a valid audio stream URL
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export function validateStreamUrl(url: string): boolean {
  if (!url) return false
  
  try {
    const parsed = new URL(url)
    
    // Check for valid protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    
    // Check that it's not empty
    if (parsed.hostname.length === 0) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}

