import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

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
 * Get cookies from Puppeteer page for authenticated requests
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @returns {Promise<string>} Cookie string for request headers
 */
async function getCookiesFromPage(page) {
  if (!page || typeof page.cookies !== 'function') {
    return '';
  }
  
  const cookies = await page.cookies();
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

/**
 * Download a single segment with retry logic
 * @param {string} segmentUrl - The segment URL
 * @param {string} cookieString - Cookies for authentication
 * @param {number} retryCount - Number of retries
 * @returns {Promise<Buffer>} The segment data
 */
async function downloadSegment(segmentUrl, cookieString, retryCount = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://frontendmasters.com/'
  };
  
  if (cookieString) {
    headers['Cookie'] = cookieString;
  }
  
  let lastError;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(segmentUrl, {
        headers,
        timeout: 30000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.buffer();
      return buffer;
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt < retryCount) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to download segment after ${retryCount} attempts: ${lastError.message}`);
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
  if (!page || typeof page.cookies !== 'function') {
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
  
  // Get cookies for authenticated requests
  const cookieString = await getCookiesFromPage(page);
  
  // Download the M3U8 playlist
  const m3u8Headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://frontendmasters.com/'
  };
  
  if (cookieString) {
    m3u8Headers['Cookie'] = cookieString;
  }
  
  let m3u8Content;
  try {
    const response = await fetch(lesson.m3u8Url, {
      headers: m3u8Headers,
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch M3U8 playlist: HTTP ${response.status}`);
    }
    
    m3u8Content = await response.text();
  } catch (error) {
    throw new Error(`Failed to download M3U8 playlist: ${error.message}`);
  }
  
  // Parse segment URLs from M3U8
  const segmentUrls = parseM3U8Playlist(m3u8Content, lesson.m3u8Url);
  
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
      const segmentData = await downloadSegment(segmentUrl, cookieString);
      await writeFile(segmentPath, segmentData);
      downloadedCount++;
    } catch (error) {
      throw new Error(`Failed to download segment ${i + 1}/${segmentUrls.length}: ${error.message}`);
    }
  }
  
  return {
    segmentCount: downloadedCount,
    tempDir
  };
}
