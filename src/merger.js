import { spawn } from 'child_process';
import { readdir, unlink, readFile } from 'fs/promises';
import path from 'path';

/**
 * Check if ffmpeg is installed and available
 * @returns {Promise<boolean>}
 */
export async function checkFfmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version'], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Read segment manifest from directory
 * @param {string} segmentsDir - Directory containing segments
 * @returns {Promise<{segments: string[], lesson?: object}>} Manifest data
 */
async function readManifest(segmentsDir) {
  const manifestPath = path.join(segmentsDir, 'manifest.json');
  
  try {
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);
    return {
      segments: manifest.segments || [],
      lesson: manifest.lesson
    };
  } catch {
    // Manifest doesn't exist or is invalid, fall back to reading directory
    return null;
  }
}

/**
 * Get segment files from directory, sorted numerically
 * @param {string} segmentsDir - Directory containing .ts files
 * @returns {Promise<string[]>} Sorted segment filenames
 */
async function getSegmentsFromDir(segmentsDir) {
  const files = await readdir(segmentsDir);
  return files
    .filter(f => f.endsWith('.ts'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('.ts', ''), 10);
      const numB = parseInt(b.replace('.ts', ''), 10);
      return numA - numB;
    });
}

/**
 * Merge TS segments into a single MP4 file using ffmpeg
 * @param {string} segmentsDir - Directory containing .ts segment files
 * @param {string} outputPath - Output MP4 file path
 * @param {Object} options - Merge options
 * @param {boolean} options.cleanup - Whether to delete TS files after merge (default: true)
 * @param {boolean} options.hardwareAccel - Whether to use hardware acceleration (default: true on macOS)
 * @returns {Promise<void>}
 */
export async function mergeSegments(segmentsDir, outputPath, options = {}) {
  // Validate inputs
  if (!segmentsDir || typeof segmentsDir !== 'string') {
    throw new Error('Segments directory is required');
  }
  
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('Output path is required');
  }

  // Check ffmpeg availability
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) {
    throw new Error(
      'ffmpeg is not installed or not available in PATH. ' +
      'Please install ffmpeg: https://ffmpeg.org/download.html'
    );
  }

  const { cleanup = true, hardwareAccel = true } = options;

  // Try to read manifest first, fall back to directory listing
  let segmentFiles = [];
  let useManifest = false;
  
  const manifest = await readManifest(segmentsDir);
  if (manifest && manifest.segments.length > 0) {
    segmentFiles = manifest.segments.map((_, index) => `${String(index).padStart(5, '0')}.ts`);
    useManifest = true;
  } else {
    segmentFiles = await getSegmentsFromDir(segmentsDir);
  }

  if (segmentFiles.length === 0) {
    throw new Error('No TS segments found in directory');
  }

  // Create concat file list for ffmpeg
  const concatFile = path.join(segmentsDir, 'concat.txt');
  const concatContent = segmentFiles
    .map(f => `file '${path.join(segmentsDir, f)}'`)
    .join('\n');
  
  const { writeFile } = await import('fs/promises');
  await writeFile(concatFile, concatContent);

  // Build ffmpeg arguments
  const ffmpegArgs = [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    '-bsf:a', 'aac_adtstoasc',
    '-movflags', '+faststart'
  ];

  // Add hardware acceleration for encoding if available (macOS)
  if (hardwareAccel && process.platform === 'darwin') {
    ffmpegArgs.push('-videotoolbox');
  }

  ffmpegArgs.push('-y', outputPath);

  // Run ffmpeg to merge segments
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      // Clean up concat file
      try {
        await unlink(concatFile);
      } catch {}

      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }

      // Clean up TS files if requested
      if (cleanup) {
        for (const file of segmentFiles) {
          try {
            await unlink(path.join(segmentsDir, file));
          } catch {
            // Ignore errors during cleanup
          }
        }
        
        // Try to remove the temp directory if empty
        try {
          const remaining = await readdir(segmentsDir);
          if (remaining.length === 0 || (remaining.length === 1 && remaining[0] === 'manifest.json')) {
            if (remaining.length === 1) {
              await unlink(path.join(segmentsDir, 'manifest.json'));
            }
            const { rmdir } = await import('fs/promises');
            await rmdir(segmentsDir);
          }
        } catch {
          // Ignore errors during cleanup
        }
      }

      resolve();
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}
