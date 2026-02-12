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
  await page.waitForSelector('.Course-Lesson-List, .Course-TOC', {
    timeout: 30000
  });

  // Collect all lesson links and metadata
  const lessons = await page.evaluate(() => {
    const lessonElements = document.querySelectorAll('li.Course-Lesson-List-Item');
    const lessonData = [];

    lessonElements.forEach((el, index) => {
      // Title is inside h3.title > a
      const titleEl = el.querySelector('.title a, h3.title a, h3 a');
      const title = titleEl ? titleEl.textContent.trim() : '';

      // Lesson URL from the title link or thumbnail link
      const linkEl = el.querySelector('.title a, a.thumbnail');
      const lessonUrl = linkEl ? linkEl.href : null;

      // Duration from timestamp link (e.g., "00:00:00 - 00:04:01")
      const timestampEl = el.querySelector('.timestamp, a.timestamp');
      const timestampText = timestampEl ? timestampEl.textContent.trim() : '';

      // Parse duration from timestamp range (e.g., "00:00:00 - 00:04:01")
      let durationSeconds = 0;
      const timeMatch = timestampText.match(/(\d+:\d+:\d+)\s*-\s*(\d+:\d+:\d+)/);
      if (timeMatch) {
        const parseTime = (t) => {
          const [h, m, s] = t.split(':').map(Number);
          return h * 3600 + m * 60 + s;
        };
        durationSeconds = parseTime(timeMatch[2]) - parseTime(timeMatch[1]);
      }

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

  // Visit each lesson and capture M3U8 URLs + response bodies
  const lessonsWithM3U8 = [];

  for (const lesson of lessons) {
    console.log(`   Extracting M3U8 for lesson ${lesson.number}: "${lesson.title}"...`);
    const m3u8Data = await extractM3U8Data(page, lesson.url);

    if (m3u8Data) {
      lessonsWithM3U8.push({
        number: lesson.number,
        title: lesson.title,
        m3u8Url: m3u8Data.masterUrl,
        m3u8Responses: m3u8Data.m3u8Responses,
        duration: lesson.duration
      });
    } else {
      console.log(`   ⚠️  No M3U8 URL found for lesson ${lesson.number}`);
    }
  }

  return lessonsWithM3U8;
}

/**
 * Extract M3U8 data from a lesson page using Puppeteer response interception.
 * Captures both URLs and response bodies for M3U8 playlists.
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} lessonUrl - The lesson URL
 * @returns {Promise<{masterUrl: string, m3u8Responses: Object<string, string>}|null>}
 */
async function extractM3U8Data(page, lessonUrl) {
  const m3u8Responses = {};

  // Use page.on('response') to capture M3U8 response bodies
  const responseHandler = async (response) => {
    const url = response.url();
    if (url.includes('.m3u8')) {
      try {
        const body = await response.text();
        m3u8Responses[url] = body;
      } catch {
        // Response body may not be available
      }
    }
  };
  page.on('response', responseHandler);

  try {
    await page.goto(lessonUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('video', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // If no M3U8 captured, try clicking play button
    if (Object.keys(m3u8Responses).length === 0) {
      const playBtn = await page.$('button[aria-label="Play video"], button.placeholder');
      if (playBtn) await playBtn.click().catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
    }
  } finally {
    page.off('response', responseHandler);
  }

  const urls = Object.keys(m3u8Responses);
  if (urls.length === 0) return null;

  // Find the master playlist URL (has signed auth params)
  const masterUrl = urls.find(u => u.includes('index.m3u8') && u.includes('Signature')) || urls[0];

  return { masterUrl, m3u8Responses };
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
    // Course title from the header
    const titleEl = document.querySelector('.Course-Header h1, main h1, h1');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // Count lessons
    const lessonElements = document.querySelectorAll('li.Course-Lesson-List-Item');
    const lessonCount = lessonElements.length;

    return { title, lessonCount };
  });

  return {
    ...metadata,
    slug: extractCourseSlug(courseUrl)
  };
}
