import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

/**
 * Extract course slug from URL
 * @param {string} courseUrl - The course URL
 * @returns {string} The course slug (e.g., "react-nextjs-state" from "https://frontendmasters.com/courses/react-nextjs-state/")
 */
export function extractCourseSlug(courseUrl) {
  if (!courseUrl || typeof courseUrl !== 'string') {
    return '';
  }
  
  try {
    const url = new URL(courseUrl);
    // URL path is like: /courses/react-nextjs-state/
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // The slug should be the second part after 'courses'
    if (pathParts[0] === 'courses' && pathParts[1]) {
      return pathParts[1];
    }
    
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Extract lesson data from a course page
 * Uses Puppeteer request interception to capture M3U8 URLs
 * 
 * @param {import('puppeteer').Page} page - Puppeteer page instance (already logged in)
 * @param {string} courseUrl - The course URL to extract from
 * @returns {Promise<Array<{number: number, title: string, m3u8Url: string, duration: number}>>} Array of lesson objects
 */
export async function extractCourseData(page, courseUrl) {
  if (!page || typeof page.goto !== 'function') {
    throw new Error('Invalid Puppeteer page instance provided');
  }
  
  if (!courseUrl || typeof courseUrl !== 'string') {
    throw new Error('Course URL is required');
  }
  
  // Navigate to the course page
  await page.goto(courseUrl, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  // Wait for the course content to load
  await page.waitForSelector('.LessonList, .lesson-list, [data-testid="lesson-list"], .Course', {
    timeout: 30000
  });
  
  // Collect all lesson links and metadata
  const lessons = await page.evaluate(() => {
    const lessonElements = document.querySelectorAll('.LessonListItem, .lesson-item, [data-testid^="lesson"], .LessonRow');
    const lessonData = [];
    
    lessonElements.forEach((el, index) => {
      // Try different selectors for title
      const titleEl = el.querySelector('.title, .lesson-title, h3, h4, [data-testid="lesson-title"]');
      const title = titleEl ? titleEl.textContent.trim() : '';
      
      // Try to find duration
      const durationEl = el.querySelector('.duration, .time, [data-testid="duration"]');
      const durationText = durationEl ? durationEl.textContent.trim() : '';
      
      // Parse duration (e.g., "1:30:00" or "30:00")
      let durationSeconds = 0;
      if (durationText) {
        const parts = durationText.split(':').map(Number);
        if (parts.length === 3) {
          durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          durationSeconds = parts[0] * 60 + parts[1];
        }
      }
      
      // Get the lesson link
      const linkEl = el.querySelector('a[href*="/lessons/"]');
      const lessonUrl = linkEl ? linkEl.href : null;
      
      if (title && lessonUrl) {
        lessonData.push({
          number: index + 1,
          title,
          duration: durationSeconds,
          url: lessonUrl
        });
      }
    });
    
    return lessonData;
  });
  
  if (lessons.length === 0) {
    throw new Error('No lessons found on the course page. The page structure may have changed.');
  }
  
  // Now visit each lesson and capture the M3U8 URL via request interception
  const lessonsWithM3U8 = [];
  
  for (const lesson of lessons) {
    const m3u8Url = await extractM3U8Url(page, lesson.url);
    
    if (m3u8Url) {
      lessonsWithM3U8.push({
        number: lesson.number,
        title: lesson.title,
        m3u8Url,
        duration: lesson.duration
      });
    }
  }
  
  return lessonsWithM3U8;
}

/**
 * Extract M3U8 URL from a lesson page using request interception
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} lessonUrl - The lesson URL
 * @returns {Promise<string|null>} The M3U8 URL or null if not found
 */
async function extractM3U8Url(page, lessonUrl) {
  // Array to capture M3U8 URLs
  const m3u8Urls = [];
  
  // Set up request interception
  const requestHandler = (request) => {
    const url = request.url();
    
    // Look for M3U8 playlist URLs
    if (url.includes('.m3u8')) {
      // Prefer 1080p quality if available
      if (url.includes('1080') || url.includes('index_0_av')) {
        m3u8Urls.unshift(url); // Add to front for priority
      } else {
        m3u8Urls.push(url);
      }
    }
    
    // Continue the request
    request.continue();
  };
  
  // Enable request interception
  await page.setRequestInterception(true);
  page.on('request', requestHandler);
  
  try {
    // Navigate to the lesson page
    await page.goto(lessonUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Wait for video player to load (this triggers the M3U8 request)
    await page.waitForTimeout(3000);
    
    // Also wait for any video element
    await page.waitForSelector('video, .video-player, [data-testid="video-player"]', {
      timeout: 10000
    }).catch(() => {
      // Video player might not be available (e.g., text lessons)
    });
    
    // Give a bit more time for M3U8 requests to complete
    await page.waitForTimeout(2000);
    
  } finally {
    // Clean up request interception
    page.off('request', requestHandler);
    await page.setRequestInterception(false);
  }
  
  // Return the first (best quality) M3U8 URL found
  return m3u8Urls.length > 0 ? m3u8Urls[0] : null;
}

/**
 * Get course metadata
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} courseUrl - The course URL
 * @returns {Promise<{title: string, slug: string, lessonCount: number}>}
 */
export async function getCourseMetadata(page, courseUrl) {
  if (!page || typeof page.goto !== 'function') {
    throw new Error('Invalid Puppeteer page instance provided');
  }
  
  await page.goto(courseUrl, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  const metadata = await page.evaluate(() => {
    // Try different selectors for course title
    const titleSelectors = [
      'h1.course-title',
      'h1[data-testid="course-title"]',
      '.course-hero h1',
      'main h1',
      'h1'
    ];
    
    let title = '';
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        title = el.textContent.trim();
        break;
      }
    }
    
    // Count lessons
    const lessonElements = document.querySelectorAll('.LessonListItem, .lesson-item, [data-testid^="lesson"], .LessonRow');
    const lessonCount = lessonElements.length;
    
    return { title, lessonCount };
  });
  
  return {
    ...metadata,
    slug: extractCourseSlug(courseUrl)
  };
}
