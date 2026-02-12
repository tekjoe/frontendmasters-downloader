import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { loadConfig } from './utils.js';

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

/**
 * Login to Frontend Masters using Puppeteer with stealth plugin
 * @param {Object} credentials - Optional credentials object with email and password
 * @param {Object} options - Login options
 * @param {boolean} options.visible - Launch visible browser for manual login
 * @returns {Promise<Object>} Object containing browser and page instances
 */
export async function login(credentials = null, options = {}) {
  const { visible = false } = options;

  let creds = credentials;

  // Load credentials from config if not provided (not needed for visible mode)
  if (!creds && !visible) {
    try {
      creds = await loadConfig();
    } catch (error) {
      throw new Error(`Failed to load credentials: ${error.message}`);
    }
  }

  if (!visible && (!creds.email || !creds.password)) {
    throw new Error('Email and password are required');
  }

  // Trim whitespace from credentials
  if (creds) {
    creds = { email: creds.email?.trim(), password: creds.password?.trim() };
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: !visible,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 60000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    if (visible) {
      return await manualLogin(browser, page);
    } else {
      return await automatedLogin(browser, page, creds);
    }
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

/**
 * Manual login: opens visible browser and waits for user to log in
 */
async function manualLogin(browser, page) {
  await page.goto('https://frontendmasters.com/login/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('🌐 Browser opened. Please log in manually.');
  console.log('   Waiting for you to complete login (up to 2 minutes)...');

  // Poll until we're no longer on the login page
  const startTime = Date.now();
  const timeout = 120000; // 2 minutes

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, 2000));
    const url = page.url();
    if (!url.includes('/login/')) {
      console.log('✅ Logged in successfully');
      return { browser, page };
    }
  }

  throw new Error('Login timed out. Please try again.');
}

/**
 * Automated login: fills in credentials and submits
 */
async function automatedLogin(browser, page, creds) {
  await page.goto('https://frontendmasters.com/login/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Check for rate limiting (429)
  const pageContent = await page.content();
  if (pageContent.includes('429') && pageContent.includes('maximum request limit')) {
    throw new Error('Rate limited by Frontend Masters (429). Try --visible flag for manual login, or wait a few minutes.');
  }

  // Wait for the login form
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });

  // Fill in and submit
  await page.type('input[name="username"]', creds.email, { delay: 50 });
  await page.type('input[name="password"]', creds.password, { delay: 50 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.click('button[type="submit"]')
  ]);

  // Check for 2FA prompt
  const currentUrl = page.url();
  if (currentUrl.includes('2fa') || currentUrl.includes('two-factor')) {
    console.log('⚠️  2FA required. Please check your device/email and complete authentication manually.');
    console.log('   Waiting for 2FA completion (60 seconds)...');
    await page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 60000
    });
  }

  // Verify successful login
  const url = page.url();
  if (url.includes('/login/')) {
    const errorText = await page.evaluate(() => {
      const body = document.body.innerText || '';
      if (body.includes("wasn't correct")) return "That wasn't correct. Check your credentials.";
      const errorEl = document.querySelector('.error, .alert-error, [role="alert"]');
      return errorEl ? errorEl.textContent.trim() : null;
    });
    throw new Error(`Login failed: ${errorText || 'Invalid credentials or form error'}`);
  }

  console.log('✅ Logged in successfully');
  return { browser, page };
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
    console.warn('Warning: Error while closing browser:', error.message);
  }
}
