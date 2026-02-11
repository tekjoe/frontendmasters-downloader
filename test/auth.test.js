import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('auth.js', () => {
  describe('module exports', () => {
    it('should export login function', async () => {
      const auth = await import('../src/auth.js');
      assert.strictEqual(typeof auth.login, 'function', 'login should be a function');
    });

    it('should export logout function', async () => {
      const auth = await import('../src/auth.js');
      assert.strictEqual(typeof auth.logout, 'function', 'logout should be a function');
    });
  });

  describe('login validation', () => {
    it('should throw error when credentials object is empty', async () => {
      const { login } = await import('../src/auth.js');
      
      await assert.rejects(
        async () => await login({}),
        /Email and password are required/
      );
    });

    it('should throw error when email is missing', async () => {
      const { login } = await import('../src/auth.js');
      
      await assert.rejects(
        async () => await login({ password: 'test123' }),
        /Email and password are required/
      );
    });

    it('should throw error when password is missing', async () => {
      const { login } = await import('../src/auth.js');
      
      await assert.rejects(
        async () => await login({ email: 'test@example.com' }),
        /Email and password are required/
      );
    });

    it('should throw error when email is empty string', async () => {
      const { login } = await import('../src/auth.js');
      
      await assert.rejects(
        async () => await login({ email: '', password: 'test123' }),
        /Email and password are required/
      );
    });

    it('should throw error when password is empty string', async () => {
      const { login } = await import('../src/auth.js');
      
      await assert.rejects(
        async () => await login({ email: 'test@example.com', password: '' }),
        /Email and password are required/
      );
    });
  });

  describe('logout', () => {
    it('should not throw when browser is null', async () => {
      const { logout } = await import('../src/auth.js');
      
      await assert.doesNotReject(async () => await logout(null));
    });

    it('should not throw when browser is undefined', async () => {
      const { logout } = await import('../src/auth.js');
      
      await assert.doesNotReject(async () => await logout(undefined));
    });

    it('should handle browser close gracefully', async () => {
      const { logout } = await import('../src/auth.js');
      
      // Mock browser object with close method
      const mockBrowser = {
        close: async () => {}
      };
      
      await assert.doesNotReject(async () => await logout(mockBrowser));
    });
  });
});
