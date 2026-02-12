import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Parse M3U8 playlist content and extract segment URLs
 * @param {string} m3u8Content - The M3U8 playlist content
 * @param {string} baseUrl - The base URL for resolving relative segment URLs
 * @returns {string[]} Array of segment URLs
 */
export function parseM3U8Playlist(m3u8Content, baseUrl) {
  if (!m3u8Content || typeof m3u8Content !== 'string') {
    throw new Error('Invalid M3U8 content provided');
  }

  const lines = m3u8Content.split('\n');
  const segmentUrls = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comments, tags, and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // This is a segment URL
    if (trimmedLine.endsWith('.ts')) {
      // Resolve relative URLs
      if (trimmedLine.startsWith('http')) {
        segmentUrls.push(trimmedLine);
      } else {
        // Relative URL - resolve against base URL
        const resolvedUrl = new URL(trimmedLine, baseUrl).href;
        segmentUrls.push(resolvedUrl);
      }
    }
  }

  return segmentUrls;
}

/**
 * Parse a master M3U8 playlist and find the best quality variant
 * @param {string} masterContent - The master M3U8 content
 * @param {string} masterUrl - The master URL for resolving relative URLs
 * @returns {string|null} The best quality variant URL or null
 */
export function parseMasterPlaylist(masterContent, masterUrl) {
  if (!masterContent || typeof masterContent !== 'string') {
    return null;
  }

  const lines = masterContent.split('\n');
  let bestUrl = null;
  let bestBandwidth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for #EXT-X-STREAM-INF which precedes variant URLs
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;

      // Next non-empty, non-comment line is the variant URL
      for (let j = i + 1; j < lines.length; j++) {
        const variantLine = lines[j].trim();
        if (variantLine && !variantLine.startsWith('#')) {
          if (bandwidth > bestBandwidth) {
            bestBandwidth = bandwidth;
            // Resolve relative URL against master URL
            bestUrl = variantLine.startsWith('http')
              ? variantLine
              : new URL(variantLine, masterUrl).href;
          }
          break;
        }
      }
    }
  }

  return bestUrl;
}

/**
 * Parse all variant streams from a master M3U8 playlist, sorted by bandwidth (highest first)
 * @param {string} masterContent - The master M3U8 content
 * @param {string} masterUrl - The master URL for resolving relative URLs
 * @returns {Array<{url: string, bandwidth: number}>}
 */
export function parseAllVariants(masterContent, masterUrl) {
  if (!masterContent || typeof masterContent !== 'string') return [];

  const lines = masterContent.split('\n');
  const variants = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;

      for (let j = i + 1; j < lines.length; j++) {
        const variantLine = lines[j].trim();
        if (variantLine && !variantLine.startsWith('#')) {
          const url = variantLine.startsWith('http')
            ? variantLine
            : new URL(variantLine, masterUrl).href;
          variants.push({ url, bandwidth });
          break;
        }
      }
    }
  }

  // Sort by bandwidth descending (highest quality first)
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return variants;
}

/**
 * Download a single segment using the browser's fetch (has CloudFront cookies).
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} segmentUrl - The segment URL
 * @param {number} retryCount - Number of retries
 * @returns {Promise<Buffer>} The segment data
 */
async function downloadSegment(page, segmentUrl, retryCount = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      // Use browser's fetch to leverage CloudFront cookies
      const base64Data = await page.evaluate(async (url) => {
        const resp = await fetch(url, { credentials: 'include' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const buf = await resp.arrayBuffer();
        // Convert to base64 for transfer to Node.js
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }, segmentUrl);

      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      lastError = error;

      if (attempt < retryCount) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to download segment after ${retryCount} attempts: ${lastError.message}`);
}

/**
 * Resolve the segment playlist from pre-captured M3U8 response bodies.
 * The extractor captures M3U8 responses via CDP during page load.
 * @param {string} masterM3u8Url - The master M3U8 URL
 * @param {Object<string, string>} m3u8Responses - Map of URL -> response body
 * @returns {{playlistUrl: string, playlistContent: string}}
 */
function resolveSegmentPlaylist(masterM3u8Url, m3u8Responses) {
  const masterContent = m3u8Responses[masterM3u8Url];
  if (!masterContent) {
    throw new Error('Master M3U8 response body not captured');
  }

  // Check if this is already a segment playlist (has .ts references)
  if (masterContent.includes('.ts')) {
    return { playlistUrl: masterM3u8Url, playlistContent: masterContent };
  }

  // Find the best variant that we actually have a captured response for.
  // The browser's HLS player typically fetches the 1080p variant, so that's
  // what we'll have in our captured responses.
  const variantUrls = parseAllVariants(masterContent, masterM3u8Url);
  if (variantUrls.length === 0) {
    throw new Error('No variant streams found in master M3U8 playlist');
  }

  // Try variants in bandwidth order, preferring the ones we actually captured
  let variantUrl = null;
  let variantContent = null;
  for (const candidate of variantUrls) {
    if (m3u8Responses[candidate.url]) {
      variantUrl = candidate.url;
      variantContent = m3u8Responses[candidate.url];
      break;
    }
  }

  if (!variantContent) {
    throw new Error(`No variant M3U8 response bodies were captured. Available: ${variantUrls.map(v => v.url.split('/').pop()).join(', ')}`);
  }

  return { playlistUrl: variantUrl, playlistContent: variantContent };
}

/**
 * Download all segments for a lesson
 * @param {import('puppeteer').Page} page - Puppeteer page instance (for authentication context)
 * @param {Object} lesson - Lesson object with {number, title, m3u8Url}
 * @param {string} outputDir - Output directory path
 * @returns {Promise<{segmentCount: number, tempDir: string}>} Download result
 */
export async function downloadLesson(page, lesson, outputDir) {
  // Validate inputs
  if (!page || typeof page.evaluate !== 'function') {
    throw new Error('Invalid Puppeteer page instance provided');
  }

  if (!lesson || typeof lesson !== 'object') {
    throw new Error('Lesson object is required');
  }

  if (!lesson.number || typeof lesson.number !== 'number') {
    throw new Error('Lesson number is required');
  }

  if (!lesson.m3u8Url || typeof lesson.m3u8Url !== 'string') {
    throw new Error('Lesson M3U8 URL is required');
  }

  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('Output directory is required');
  }

  // Create temp directory for segments
  const tempDir = path.join(outputDir, '.temp', String(lesson.number));
  await mkdir(tempDir, { recursive: true });

  // Resolve the segment playlist from pre-captured M3U8 response bodies
  let playlistUrl, playlistContent;
  try {
    ({ playlistUrl, playlistContent } = resolveSegmentPlaylist(lesson.m3u8Url, lesson.m3u8Responses || {}));
  } catch (error) {
    throw new Error(`Failed to download M3U8 playlist: ${error.message}`);
  }

  // Parse segment URLs
  const segmentUrls = parseM3U8Playlist(playlistContent, playlistUrl);

  if (segmentUrls.length === 0) {
    throw new Error('No video segments found in M3U8 playlist');
  }

  // Download each segment
  let downloadedCount = 0;

  for (let i = 0; i < segmentUrls.length; i++) {
    const segmentUrl = segmentUrls[i];
    const segmentFileName = `${String(i).padStart(5, '0')}.ts`;
    const segmentPath = path.join(tempDir, segmentFileName);

    try {
      const segmentData = await downloadSegment(page, segmentUrl);
      await writeFile(segmentPath, segmentData);
      downloadedCount++;
      // Log progress every 10 segments
      if (downloadedCount % 10 === 0 || downloadedCount === segmentUrls.length) {
        process.stdout.write(`\r   Downloading segments: ${downloadedCount}/${segmentUrls.length}`);
      }
    } catch (error) {
      throw new Error(`Failed to download segment ${i + 1}/${segmentUrls.length}: ${error.message}`);
    }
  }

  return {
    segmentCount: downloadedCount,
    tempDir
  };
}
