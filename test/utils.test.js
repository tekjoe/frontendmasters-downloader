import { describe, it } from 'node:test';
import assert from 'node:assert';
import { slugify, sanitizeFilename, loadConfig, ensureDir, formatDuration } from '../src/utils.js';
import { rm, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

describe('utils', () => {
  describe('slugify', () => {
    it('converts strings to URL-friendly slugs', () => {
      assert.strictEqual(slugify('React & Next.js State'), 'react-and-nextjs-state');
      assert.strictEqual(slugify('Hello World'), 'hello-world');
      assert.strictEqual(slugify('UPPER CASE'), 'upper-case');
    });

    it('handles special characters', () => {
      assert.strictEqual(slugify('a@b#c$d'), 'abcd');
      assert.strictEqual(slugify('spaces   everywhere'), 'spaces-everywhere');
    });

    it('handles edge cases', () => {
      assert.strictEqual(slugify(''), '');
      assert.strictEqual(slugify(null), '');
      assert.strictEqual(slugify(undefined), '');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes illegal characters from filenames', () => {
      assert.strictEqual(sanitizeFilename('lesson: introduction'), 'lesson introduction');
      assert.strictEqual(sanitizeFilename('file<name>'), 'filename');
      assert.strictEqual(sanitizeFilename('test|pipe'), 'testpipe');
    });

    it('handles multiple illegal characters', () => {
      assert.strictEqual(sanitizeFilename('a:b*c?d"e<f>g|h/i\\j'), 'abcdefghij');
    });

    it('handles edge cases', () => {
      assert.strictEqual(sanitizeFilename(''), '');
      assert.strictEqual(sanitizeFilename(null), '');
      assert.strictEqual(sanitizeFilename(undefined), '');
    });
  });

  describe('loadConfig', () => {
    it('reads and parses config file', async () => {
      const config = await loadConfig();
      assert.strictEqual(typeof config, 'object');
      assert.ok('email' in config);
      assert.ok('password' in config);
    });

    it('reads from custom path', async () => {
      const tmpDir = os.tmpdir();
      const testConfigPath = path.join(tmpDir, 'test-config.json');
      await writeFile(testConfigPath, JSON.stringify({ test: true, value: 42 }));
      
      const config = await loadConfig(testConfigPath);
      assert.strictEqual(config.test, true);
      assert.strictEqual(config.value, 42);
      
      await rm(testConfigPath);
    });
  });

  describe('ensureDir', () => {
    it('creates directory if it does not exist', async () => {
      const tmpDir = path.join(os.tmpdir(), `test-dir-${Date.now()}`);
      
      assert.strictEqual(existsSync(tmpDir), false);
      await ensureDir(tmpDir);
      assert.strictEqual(existsSync(tmpDir), true);
      
      await rm(tmpDir, { recursive: true });
    });

    it('does not throw if directory already exists', async () => {
      const tmpDir = path.join(os.tmpdir(), `test-dir-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      
      await assert.doesNotReject(ensureDir(tmpDir));
      
      await rm(tmpDir, { recursive: true });
    });

    it('creates nested directories', async () => {
      const baseDir = path.join(os.tmpdir(), `test-nested-${Date.now()}`);
      const nestedDir = path.join(baseDir, 'level1', 'level2');
      
      await ensureDir(nestedDir);
      assert.strictEqual(existsSync(nestedDir), true);
      
      await rm(baseDir, { recursive: true });
    });
  });

  describe('formatDuration', () => {
    it('formats seconds to HH:MM:SS', () => {
      assert.strictEqual(formatDuration(3661), '1:01:01');
      assert.strictEqual(formatDuration(3600), '1:00:00');
      assert.strictEqual(formatDuration(3660), '1:01:00');
    });

    it('formats seconds to MM:SS when under an hour', () => {
      assert.strictEqual(formatDuration(65), '1:05');
      assert.strictEqual(formatDuration(60), '1:00');
      assert.strictEqual(formatDuration(59), '0:59');
    });

    it('handles edge cases', () => {
      assert.strictEqual(formatDuration(0), '0:00');
      assert.strictEqual(formatDuration(-1), '0:00:00');
      assert.strictEqual(formatDuration(null), '0:00:00');
      assert.strictEqual(formatDuration(undefined), '0:00:00');
    });
  });
});
