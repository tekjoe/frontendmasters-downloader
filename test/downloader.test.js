import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseM3U8Playlist, downloadLesson } from '../src/downloader.js';

describe('downloader.js', () => {
  describe('parseM3U8Playlist', () => {
    it('should parse M3U8 playlist and extract segment URLs', () => {
      const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.000,
segment_0.ts
#EXTINF:10.000,
segment_1.ts
#EXTINF:5.000,
segment_2.ts
#EXT-X-ENDLIST`;

      const baseUrl = 'https://example.com/video/playlist.m3u8';
      const segments = parseM3U8Playlist(m3u8Content, baseUrl);

      assert.strictEqual(segments.length, 3);
      assert.strictEqual(segments[0], 'https://example.com/video/segment_0.ts');
      assert.strictEqual(segments[1], 'https://example.com/video/segment_1.ts');
      assert.strictEqual(segments[2], 'https://example.com/video/segment_2.ts');
    });

    it('should handle absolute segment URLs', () => {
      const m3u8Content = `#EXTM3U
#EXTINF:10.000,
https://cdn.example.com/segment_0.ts
#EXTINF:10.000,
https://cdn.example.com/segment_1.ts
#EXT-X-ENDLIST`;

      const baseUrl = 'https://example.com/video/playlist.m3u8';
      const segments = parseM3U8Playlist(m3u8Content, baseUrl);

      assert.strictEqual(segments.length, 2);
      assert.strictEqual(segments[0], 'https://cdn.example.com/segment_0.ts');
      assert.strictEqual(segments[1], 'https://cdn.example.com/segment_1.ts');
    });

    it('should throw error for invalid M3U8 content', () => {
      assert.throws(() => parseM3U8Playlist(null, 'https://example.com'), /Invalid M3U8 content/);
      assert.throws(() => parseM3U8Playlist(undefined, 'https://example.com'), /Invalid M3U8 content/);
      assert.throws(() => parseM3U8Playlist('', 'https://example.com'), /Invalid M3U8 content/);
    });

    it('should return empty array for M3U8 without segments', () => {
      const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-ENDLIST`;

      const baseUrl = 'https://example.com/video/playlist.m3u8';
      const segments = parseM3U8Playlist(m3u8Content, baseUrl);

      assert.strictEqual(segments.length, 0);
    });

    it('should handle nested path segments in relative URLs', () => {
      const m3u8Content = `#EXTM3U
#EXTINF:10.000,
segments/1080p/segment_0.ts
#EXT-X-ENDLIST`;

      const baseUrl = 'https://example.com/course/lesson/playlist.m3u8';
      const segments = parseM3U8Playlist(m3u8Content, baseUrl);

      assert.strictEqual(segments.length, 1);
      assert.strictEqual(segments[0], 'https://example.com/course/lesson/segments/1080p/segment_0.ts');
    });

    it('should ignore non-.ts lines', () => {
      const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.000,
segment_0.ts
#EXT-X-DISCONTINUITY
#EXTINF:10.000,
segment_1.ts
https://example.com/not-a-segment.mp4
#EXT-X-ENDLIST`;

      const baseUrl = 'https://example.com/video/playlist.m3u8';
      const segments = parseM3U8Playlist(m3u8Content, baseUrl);

      assert.strictEqual(segments.length, 2);
      assert.ok(segments.every(url => url.endsWith('.ts')));
    });
  });

  describe('downloadLesson exports', () => {
    it('should export downloadLesson function', () => {
      assert.strictEqual(typeof downloadLesson, 'function');
    });

    it('should export parseM3U8Playlist function', () => {
      assert.strictEqual(typeof parseM3U8Playlist, 'function');
    });
  });

  describe('downloadLesson validation', () => {
    it('should throw error when page is null', async () => {
      await assert.rejects(
        async () => await downloadLesson(null, { number: 1, m3u8Url: 'https://example.com' }, '/output'),
        /Invalid Puppeteer page instance/
      );
    });

    it('should throw error when page is undefined', async () => {
      await assert.rejects(
        async () => await downloadLesson(undefined, { number: 1, m3u8Url: 'https://example.com' }, '/output'),
        /Invalid Puppeteer page instance/
      );
    });

    it('should throw error when page lacks cookies method', async () => {
      await assert.rejects(
        async () => await downloadLesson({}, { number: 1, m3u8Url: 'https://example.com' }, '/output'),
        /Invalid Puppeteer page instance/
      );
    });

    it('should throw error when lesson is null', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, null, '/output'),
        /Lesson object is required/
      );
    });

    it('should throw error when lesson is undefined', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, undefined, '/output'),
        /Lesson object is required/
      );
    });

    it('should throw error when lesson number is missing', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, { m3u8Url: 'https://example.com' }, '/output'),
        /Lesson number is required/
      );
    });

    it('should throw error when lesson M3U8 URL is missing', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, { number: 1 }, '/output'),
        /Lesson M3U8 URL is required/
      );
    });

    it('should throw error when outputDir is missing', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, { number: 1, m3u8Url: 'https://example.com' }, null),
        /Output directory is required/
      );
    });

    it('should throw error when outputDir is empty string', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, { number: 1, m3u8Url: 'https://example.com' }, ''),
        /Output directory is required/
      );
    });
  });

  describe('lesson object structure validation', () => {
    it('should accept valid lesson object with all required fields', async () => {
      // This test documents the expected lesson structure
      const lesson = {
        number: 1,
        title: 'Introduction',
        m3u8Url: 'https://example.com/video.m3u8',
        duration: 300
      };

      assert.strictEqual(typeof lesson.number, 'number');
      assert.strictEqual(typeof lesson.m3u8Url, 'string');
      assert.ok(lesson.m3u8Url.length > 0);
    });

    it('should validate lesson number is a number', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, { number: 'one', m3u8Url: 'https://example.com' }, '/output'),
        /Lesson number is required/
      );
    });

    it('should validate lesson M3U8 URL is a string', async () => {
      const mockPage = { cookies: () => Promise.resolve([]) };
      await assert.rejects(
        async () => await downloadLesson(mockPage, { number: 1, m3u8Url: 123 }, '/output'),
        /Lesson M3U8 URL is required/
      );
    });
  });
});
