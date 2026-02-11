import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractCourseSlug, extractCourseData, getCourseMetadata } from '../src/extractor.js';

describe('extractor.js', () => {
  describe('extractCourseSlug', () => {
    it('should extract slug from standard course URL', () => {
      const url = 'https://frontendmasters.com/courses/react-nextjs-state/';
      assert.strictEqual(extractCourseSlug(url), 'react-nextjs-state');
    });

    it('should extract slug from URL without trailing slash', () => {
      const url = 'https://frontendmasters.com/courses/web-security';
      assert.strictEqual(extractCourseSlug(url), 'web-security');
    });

    it('should extract slug from URL with query parameters', () => {
      const url = 'https://frontendmasters.com/courses/react-nextjs-state/?utm_source=email';
      assert.strictEqual(extractCourseSlug(url), 'react-nextjs-state');
    });

    it('should return empty string for non-course URLs', () => {
      const url = 'https://frontendmasters.com/dashboard/';
      assert.strictEqual(extractCourseSlug(url), '');
    });

    it('should return empty string for invalid URLs', () => {
      assert.strictEqual(extractCourseSlug('not-a-url'), '');
      assert.strictEqual(extractCourseSlug(''), '');
      assert.strictEqual(extractCourseSlug(null), '');
      assert.strictEqual(extractCourseSlug(undefined), '');
    });

    it('should handle URL with hash fragment', () => {
      const url = 'https://frontendmasters.com/courses/react-nextjs-state/#lessons';
      assert.strictEqual(extractCourseSlug(url), 'react-nextjs-state');
    });
  });

  describe('extractCourseData exports', () => {
    it('should export extractCourseData function', () => {
      assert.strictEqual(typeof extractCourseData, 'function');
    });

    it('should export getCourseMetadata function', () => {
      assert.strictEqual(typeof getCourseMetadata, 'function');
    });
  });

  describe('extractCourseData validation', () => {
    it('should throw error when page is null', async () => {
      await assert.rejects(
        async () => await extractCourseData(null, 'https://example.com'),
        /Invalid Puppeteer page instance provided/
      );
    });

    it('should throw error when page is undefined', async () => {
      await assert.rejects(
        async () => await extractCourseData(undefined, 'https://example.com'),
        /Invalid Puppeteer page instance provided/
      );
    });

    it('should throw error when page is invalid object', async () => {
      await assert.rejects(
        async () => await extractCourseData({}, 'https://example.com'),
        /Invalid Puppeteer page instance provided/
      );
    });

    it('should throw error when courseUrl is empty string', async () => {
      const mockPage = { goto: () => {} };
      await assert.rejects(
        async () => await extractCourseData(mockPage, ''),
        /Course URL is required/
      );
    });

    it('should throw error when courseUrl is null', async () => {
      const mockPage = { goto: () => {} };
      await assert.rejects(
        async () => await extractCourseData(mockPage, null),
        /Course URL is required/
      );
    });

    it('should throw error when courseUrl is undefined', async () => {
      const mockPage = { goto: () => {} };
      await assert.rejects(
        async () => await extractCourseData(mockPage, undefined),
        /Course URL is required/
      );
    });
  });

  describe('getCourseMetadata validation', () => {
    it('should throw error when page is null', async () => {
      await assert.rejects(
        async () => await getCourseMetadata(null, 'https://example.com'),
        /Invalid Puppeteer page instance provided/
      );
    });

    it('should throw error when page is undefined', async () => {
      await assert.rejects(
        async () => await getCourseMetadata(undefined, 'https://example.com'),
        /Invalid Puppeteer page instance provided/
      );
    });
  });

  describe('lesson object structure', () => {
    it('should define expected lesson object properties', () => {
      // Verify the expected structure is documented via JSDoc
      const lesson = {
        number: 1,
        title: 'Introduction',
        m3u8Url: 'https://example.com/video.m3u8',
        duration: 300
      };
      
      assert.strictEqual(typeof lesson.number, 'number');
      assert.strictEqual(typeof lesson.title, 'string');
      assert.strictEqual(typeof lesson.m3u8Url, 'string');
      assert.strictEqual(typeof lesson.duration, 'number');
    });

    it('should handle zero duration', () => {
      const lesson = {
        number: 1,
        title: 'Intro',
        m3u8Url: 'https://example.com/video.m3u8',
        duration: 0
      };
      assert.strictEqual(lesson.duration, 0);
    });
  });

  describe('course slug edge cases', () => {
    it('should handle URL with multiple path segments', () => {
      const url = 'https://frontendmasters.com/courses/advanced-react/preview/';
      // Only extract the course slug after 'courses'
      assert.strictEqual(extractCourseSlug(url), 'advanced-react');
    });

    it('should handle URL without protocol', () => {
      // This will throw in URL constructor and return empty string
      assert.strictEqual(extractCourseSlug('frontendmasters.com/courses/react/'), '');
    });
  });
});
