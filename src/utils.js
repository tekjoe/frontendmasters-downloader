import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Convert a string to a URL-friendly slug
 * @param {string} str - The string to slugify
 * @returns {string} The slugified string
 */
export function slugify(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Remove illegal characters from filenames
 * @param {string} filename - The filename to sanitize
 * @returns {string} The sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  // Remove illegal characters: < > : " / \ | ? *
  return filename.replace(/[<>:"/\\|?*]/g, '');
}

/**
 * Read and parse config/credentials.json
 * @param {string} configPath - Path to config file (default: config/credentials.json)
 * @returns {Promise<Object>} The parsed config object
 */
export async function loadConfig(configPath = 'config/credentials.json') {
  const fullPath = path.resolve(configPath);
  const content = await readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Create directories if they don't exist
 * @param {string} dirPath - The directory path to create
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Format seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00:00';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
