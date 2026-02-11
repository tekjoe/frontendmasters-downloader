import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir, readdir, rmdir, stat, unlink } from 'fs/promises';
import path from 'path';
import { login } from './auth.js';
import { downloadLesson } from './downloader.js';
import { extractCourseData, getCourseMetadata } from './extractor.js';
import { checkFfmpeg, mergeSegments } from './merger.js';
import { slugify } from './utils.js';

const PROGRESS_FILE = '.download-progress.json';

/**
 * Load download progress
 * @param {string} outputDir - Output directory
 * @returns {Object} Progress object
 */
function loadProgress(outputDir) {
  const progressPath = path.join(outputDir, PROGRESS_FILE);
  if (existsSync(progressPath)) {
    try {
      return JSON.parse(readFileSync(progressPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Save download progress
 * @param {string} outputDir - Output directory  
 * @param {Object} progress - Progress object
 */
function saveProgress(outputDir, progress) {
  const progressPath = path.join(outputDir, PROGRESS_FILE);
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Download an entire course
 * @param {string} courseUrl - Course URL
 * @param {Object} options - Options
 * @param {string} options.email - Login email
 * @param {string} options.password - Login password
 * @param {string} options.outputDir - Output directory
 * @param {number} options.concurrency - Number of concurrent downloads (default: 1)
 * @param {boolean} options.keepTemp - Keep temporary files after download
 */
export async function downloadCourse(courseUrl, options) {
  const { email, password, outputDir: customOutputDir, keepTemp = false } = options;
  
  // Check ffmpeg first
  console.log('Checking ffmpeg installation...');
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) {
    console.error('❌ ffmpeg is not installed. Please install ffmpeg first.');
    console.error('   macOS: brew install ffmpeg');
    console.error('   Ubuntu: sudo apt install ffmpeg');
    process.exit(1);
  }
  console.log('✅ ffmpeg found\n');
  
  // Login and get browser/page
  console.log('Logging in to Frontend Masters...');
  const { browser, page } = await login(email, password);
  
  try {
    // Get course metadata
    console.log('Fetching course metadata...');
    const metadata = await getCourseMetadata(page, courseUrl);
    console.log(`📚 Course: ${metadata.title}`);
    console.log(`🎬 Lessons: ${metadata.lessonCount}\n`);
    
    // Set up output directory
    const courseSlug = metadata.slug || 'course';
    const outputDir = customOutputDir || path.join(process.cwd(), 'downloads', courseSlug);
    await mkdir(outputDir, { recursive: true });
    
    // Load progress
    const progress = loadProgress(outputDir);
    const completedLessons = progress.completed || [];
    
    if (completedLessons.length > 0) {
      console.log(`📋 Resuming: ${completedLessons.length} lessons already downloaded\n`);
    }
    
    // Extract course data (lesson URLs and M3U8s)
    console.log('Extracting lesson data (this may take a while)...');
    const lessons = await extractCourseData(page, courseUrl);
    console.log(`✅ Found ${lessons.length} lessons\n`);
    
    // Download each lesson
    for (const lesson of lessons) {
      if (completedLessons.includes(lesson.number)) {
        console.log(`⏭️  Lesson ${lesson.number}/${lessons.length}: "${lesson.title}" - Already downloaded`);
        continue;
      }
      
      console.log(`\n📥 Lesson ${lesson.number}/${lessons.length}: "${lesson.title}"`);
      
      try {
        // Download segments
        const { segmentCount, tempDir } = await downloadLesson(page, lesson, outputDir);
        console.log(`   Downloaded ${segmentCount} segments`);
        
        // Merge to MP4
        const safeTitle = slugify(lesson.title);
        const outputFile = path.join(outputDir, `${String(lesson.number).padStart(2, '0')}-${safeTitle}.mp4`);
        
        console.log('   Merging segments...');
        await mergeSegments(tempDir, outputFile);
        console.log(`   ✅ Saved: ${path.basename(outputFile)}`);
        
        // Update progress
        completedLessons.push(lesson.number);
        saveProgress(outputDir, { completed: completedLessons, total: lessons.length });
        
        // Clean up temp files unless keepTemp is set
        if (!keepTemp) {
          const files = await readdir(tempDir);
          for (const file of files) {
            await unlink(path.join(tempDir, file));
          }
          await rmdir(tempDir);
        }
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        // Continue with next lesson
      }
    }
    
    console.log('\n🎉 Download complete!');
    console.log(`📁 Files saved to: ${outputDir}`);
    
  } finally {
    await browser.close();
  }
}
