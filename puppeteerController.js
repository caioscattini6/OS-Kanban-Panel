// puppeteerController.js
// Robust controller: try to connect to an existing Chrome (remote debugging) so we open a NEW TAB
// If connection fails, launch Chrome via puppeteer-core (requires PUPPETEER_EXECUTABLE_PATH).
//
// Usage: const pc = require('./puppeteerController'); await pc.searchOS('12345');

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const CONTA_AZUL_BASE = 'https://app.contaazul.com';
const ORDER_PAGE = `${CONTA_AZUL_BASE}/#/ordens-de-servico`;
const LOGIN_PAGE = `${CONTA_AZUL_BASE}/login`;

const USER_DATA_DIR = path.join(__dirname, 'puppeteer_user_data');

let browser = null;

/**
 * Try to connect to an already-running Chrome (remote debugging).
 * FALLBACK: launch a new Chrome process with executablePath.
 */
async function connectOrLaunchBrowser() {
  if (browser) return browser;

  // Prefer explicit remote debugging URL from env:
  const remoteUrl = process.env.PUPPETEER_REMOTE_DEBUGGING_URL || process.env.PUPPETEER_REMOTE_DEBUGGING_HOST;
  const defaultRemote = 'http://127.0.0.1:9222';

  // Try explicit remote if given
  const tryUrls = [];
  if (remoteUrl) tryUrls.push(remoteUrl);
  tryUrls.push(defaultRemote);

  for (const url of tryUrls) {
    try {
      console.log(`Trying to connect to existing Chrome at ${url} ...`);
      browser = await puppeteer.connect({ browserURL: url, defaultViewport: null });
      console.log('Connected to existing Chrome via remote debugging:', url);
      return browser;
    } catch (err) {
      console.log(`Connect to ${url} failed: ${err.message}`);
    }
  }

  // If we reach here, no remote Chrome to connect. Launch a new Chrome process:
  const exePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!exePath) {
    throw new Error('puppeteer-core requires PUPPETEER_EXECUTABLE_PATH or a running Chrome with remote debugging. Set PUPPETEER_EXECUTABLE_PATH in your .env, or start Chrome with --remote-debugging-port=9222');
  }

  console.log('Launching new Chrome using puppeteer-core at:', exePath);
  browser = await puppeteer.launch({
    executablePath: exePath,
    headless: false,
    userDataDir: USER_DATA_DIR,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  return browser;
}

/**
 * Ensure a given page/tab is logged in. We accept a page object (tab) to operate on.
 * If env credentials exist, try automated login; otherwise wait for manual login.
 */
async function ensureLoggedInOnPage(page) {
  // Try to detect if already logged in (presence of search input)
  try {
    await page.waitForSelector('#workOrderTextualSearch', { timeout: 5000 });
    console.log('Already logged in (search input present).');
    return true;
  } catch (_) {
    // not logged in
  }

  // Go to login explicitly
  try {
    await page.goto(LOGIN_PAGE, { waitUntil: 'networkidle2' });
  } catch (err) {
    console.warn('Goto login failed (will continue):', err.message);
  }

  const EMAIL = process.env.CONTA_AZUL_EMAIL;
  const PASS = process.env.CONTA_AZUL_PASSWORD;

  if (!EMAIL || !PASS) {
    console.warn('No credentials in .env. Please log in manually in the opened Chrome tab. Waiting for login...');
    // wait indefinitely until the search input appears
    await page.waitForSelector('#workOrderTextualSearch', { timeout: 0 });
    return true;
  }

  // Attempt automated login with robust selectors
  try {
    // Try common email/pass selectors
    const emailCandidates = ['input[type="email"]', 'input[name="email"]', 'input#email', 'input[id*="email"]'];
    const passCandidates = ['input[type="password"]', 'input[name="password"]', 'input#password', 'input[id*="password"]'];

    let emailSel = null, passSel = null;
    for (const s of emailCandidates) {
      if (await page.$(s)) { emailSel = s; break; }
    }
    for (const s of passCandidates) {
      if (await page.$(s)) { passSel = s; break; }
    }

    if (!emailSel || !passSel) {
      console.warn('Could not auto-detect login fields — please login manually.');
      await page.waitForSelector('#workOrderTextualSearch', { timeout: 0 });
      return true;
    }

    // Fill and submit
    await page.click(emailSel, { clickCount: 3 }).catch(()=>{});
    await page.type(emailSel, EMAIL, { delay: 60 });
    await page.click(passSel, { clickCount: 3 }).catch(()=>{});
    await page.type(passSel, PASS, { delay: 60 });

    // Try pressing primary submit button or Enter
    const submitCandidates = ['button[type="submit"]', 'button.login-button', 'button.btn-primary', 'button'];
    let clicked = false;
    for (const s of submitCandidates) {
      const el = await page.$(s);
      if (el) {
        try { await el.click(); clicked = true; break; } catch(_) {}
      }
    }
    if (!clicked) {
      await page.keyboard.press('Enter');
    }

    // Now wait for authenticated area
    try {
      await page.waitForSelector('#workOrderTextualSearch', { timeout: 20000 });
      console.log('Automated login succeeded (search input present).');
      return true;
    } catch(err) {
      console.warn('Automated login did not reach search input. Waiting for manual login...');
      await page.waitForSelector('#workOrderTextualSearch', { timeout: 0 });
      return true;
    }
  } catch (err) {
    console.error('Error during automated login attempt:', err.message || err);
    console.warn('Please login manually in the opened browser tab.');
    await page.waitForSelector('#workOrderTextualSearch', { timeout: 0 });
    return true;
  }
}

/**
 * Open a new tab and perform the search.
 * This uses the same browser process (so it opens a tab in the same Chrome).
 */
async function searchOS(osNumber) {
  const b = await connectOrLaunchBrowser();

  // open a new tab
  const page = await b.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Navigate to the orders page; sometimes SPA routes behave better when visiting base then hash.
    await page.goto(CONTA_AZUL_BASE, { waitUntil: 'networkidle2' });

    // Try to ensure login on this page/tab (will navigate to login and back as needed)
    await ensureLoggedInOnPage(page);

    // After login, navigate explicitly to orders route
    try {
      await page.goto(ORDER_PAGE, { waitUntil: 'networkidle2' });
    } catch (_) {
      // fallback: set hash
      try {
        await page.evaluate(() => { window.location.hash = '#/ordens-de-servico'; });
      } catch(_) {}
    }

    // Wait for search input
    try {
      await page.waitForSelector('#workOrderTextualSearch', { timeout: 15000 });
    } catch (err) {
      const msg = 'Timeout waiting for #workOrderTextualSearch. Page URL: ' + (page.url && page.url());
      console.error(msg);
      // Save screenshot for debugging
      try { await page.screenshot({ path: 'puppeteer-workorder-missing.png', fullPage: true }); } catch (_) {}
      throw new Error(msg);
    }

    // Fill the input
    const input = await page.$('#workOrderTextualSearch');
    await input.click({ clickCount: 3 });
    await input.type(String(osNumber), { delay: 60 });

    // Click search
    const searchBtn = await page.$('#searchWorkOrder');
    if (!searchBtn) {
      throw new Error('#searchWorkOrder button not found');
    }
    await searchBtn.click();

    // allow results to render for a moment (so the user sees it)
    await page.waitForTimeout(1500);

    // keep the page open so the user can view it (do not close)
    return { ok: true, message: `Search executed for ${osNumber}` };
  } catch (err) {
    console.error('searchOS error:', err && err.message ? err.message : err);
    try { await page.screenshot({ path: 'puppeteer-error.png', fullPage: true }); } catch (_) {}
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = {
  connectOrLaunchBrowser,
  searchOS
};
