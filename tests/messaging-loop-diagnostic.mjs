import { chromium } from 'playwright';

const originalLaunch = chromium.launch.bind(chromium);

chromium.launch = async (...args) => {
  const browser = await originalLaunch(...args);
  const originalNewPage = browser.newPage.bind(browser);

  browser.newPage = async (...pageArgs) => {
    const page = await originalNewPage(...pageArgs);
    const originalOn = page.on.bind(page);

    page.on = (event, listener) => {
      if (event !== 'console') return originalOn(event, listener);
      return originalOn(event, (message) => {
        const source = String(message.location().url || '');
        const knownBrowserNoise = message.type() === 'error' && message.text().includes('ERR_INVALID_URL') && source.startsWith('data:image/jpeg');
        if (!knownBrowserNoise) listener(message);
      });
    };

    return page;
  };

  return browser;
};

await import('./messaging-loop.mjs');
