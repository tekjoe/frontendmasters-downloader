import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { loadConfig } from './utils.js';

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

/**
 * Login to Frontend Masters using Puppeteer with stealth plugin
 * @param {Object} credentials - Optional credentials object with email and password
 * @returns {Promise<Object>} Object containing browser and page instances
 */
export async function login(credentials = null) {
  let creds = credentials;
  
  // Load credentials from config if not provided
  if (!creds) {
    try {
      creds = await loadConfig();
    } catch (error) {
      throw new Error(`Failed to load credentials: ${error.message}`);
    }
  }
  
  if (!creds.email || !creds.password) {
    throw new Error('Email and password are required');
  }
  
  // Launch browser with stealth plugin
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport to avoid detection
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // Navigate to login page
    await page.goto('https://frontendmasters.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for the login form to be ready
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    
    // Fill in email and password
    await page.type('input[name="email"]', creds.email, { delay: 50 });
    await page.type('input[name="password"]', creds.password, { delay: 50 });
    
    // Submit the form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button[type="submit"]')
    ]);
    
    // Check for 2FA prompt
    const currentUrl = page.url();
    if (currentUrl.includes('2fa') || currentUrl.includes('two-factor')) {
      console.log('⚠️  2FA required. Please check your device/email and complete authentication manually.');
      console.log('   Waiting for 2FA completion (60 seconds)...');
      
      // Wait for navigation to dashboard after 2FA
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
    }
    
    // Verify successful login by checking we're on the dashboard or account page
    const url = page.url();
    if (!url.includes('frontendmasters.com')) {
      throw new Error('Login failed: unexpected redirect');
    }
    
    // Check for common indicators of being logged in
    const isLoggedIn = await page.evaluate(() => {
      // Look for elements that indicate logged-in state
      const accountLink = document.querySelector('a[href="/accounts/settings/"]');
      const dashboardLink = document.querySelector('a[href="/dashboard/"]');
      const userMenu = document.querySelector('[data-testid="user-menu"]');
      const logoutButton = document.querySelector('a[href="/accounts/logout/"]');
      return !!(accountLink || dashboardLink || userMenu || logoutButton);
    });
    
    if (!isLoggedIn) {
      // Check if still on login page (failed login)
      if (url.includes('/login/')) {
        const errorText = await page.evaluate(() => {
          const errorEl = document.querySelector('.error, .alert-error, [role="alert"]');
          return errorEl ? errorEl.textContent.trim() : null;
        });
        throw new Error(`Login failed: ${errorText || 'Invalid credentials or form error'}`);
      }
    }
    
    return { browser, page };
  } catch (error) {
    // Clean up on error
    await browser.close().catch(() => {});
    throw error;
  }
}

/**
 * Logout and close the browser instance
 * @param {Object} browser - The puppeteer browser instance
 * @returns {Promise<void>}
 */
export async function logout(browser) {
  if (!browser) {
    return;
  }
  
  try {
    await browser.close();
  } catch (error) {
    // Browser might already be closed
    console.warn('Warning: Error while closing browser:', error.message);
  }
}
