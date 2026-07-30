import { chromium } from 'playwright';

const originalLaunch = chromium.launch.bind(chromium);

chromium.launch = async (...args) => {
  const browser = await originalLaunch(...args);
  const originalNewPage = browser.newPage.bind(browser);

  browser.newPage = async (...pageArgs) => {
    const page = await originalNewPage(...pageArgs);

    await page.addInitScript(() => {
      const isTarget = (value) => typeof value === 'string' && value.startsWith('data:image/jpeg;base64');
      const report = (kind, value, detail = '') => {
        console.log(`[data-image-source] ${kind} len=${value.length} prefix=${value.slice(0, 48)} ${detail}\n${new Error().stack || ''}`);
      };

      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function setAttribute(name, value) {
        if (String(name).toLowerCase() === 'src' && isTarget(value)) {
          report('setAttribute-src', value, `${this.tagName || ''}#${this.id || ''}.${this.className || ''}`);
        }
        return originalSetAttribute.call(this, name, value);
      };

      const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (imageSrc?.configurable && imageSrc.set && imageSrc.get) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: true,
          enumerable: imageSrc.enumerable,
          get: imageSrc.get,
          set(value) {
            if (isTarget(value)) report('image-src', value, `IMG#${this.id || ''}.${this.className || ''}`);
            return imageSrc.set.call(this, value);
          }
        });
      }

      const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function setProperty(name, value, priority) {
        if (isTarget(value) || (typeof value === 'string' && value.includes('data:image/jpeg;base64'))) {
          report(`style-setProperty-${name}`, value);
        }
        return originalSetProperty.call(this, name, value, priority);
      };

      const backgroundImage = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'backgroundImage');
      if (backgroundImage?.configurable && backgroundImage.set && backgroundImage.get) {
        Object.defineProperty(CSSStyleDeclaration.prototype, 'backgroundImage', {
          configurable: true,
          enumerable: backgroundImage.enumerable,
          get: backgroundImage.get,
          set(value) {
            if (typeof value === 'string' && value.includes('data:image/jpeg;base64')) {
              report('backgroundImage', value);
            }
            return backgroundImage.set.call(this, value);
          }
        });
      }

      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          document.querySelectorAll('img').forEach((image) => {
            const source = image.getAttribute('src') || '';
            if (isTarget(source)) report('dom-img', source, `IMG#${image.id || ''}.${image.className || ''}`);
          });
          document.querySelectorAll('[style]').forEach((element) => {
            const style = element.getAttribute('style') || '';
            if (style.includes('data:image/jpeg;base64')) {
              report('dom-inline-style', style, `${element.tagName || ''}#${element.id || ''}.${element.className || ''}`);
            }
          });
          document.querySelectorAll('style').forEach((styleElement, index) => {
            const css = styleElement.textContent || '';
            if (css.includes('data:image/jpeg;base64')) {
              report('dom-style-tag', css, `style-index=${index} id=${styleElement.id || ''}`);
            }
          });
        }, 0);
      });
    });

    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[data-image-source]')) {
        console.log(text);
        return;
      }
      if (message.type() !== 'error') return;
      const location = message.location();
      console.error(`[messaging diagnostic][console] ${text} @ ${location.url || 'unknown'}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`);
    });

    page.on('requestfailed', (request) => {
      const url = request.url();
      const safeUrl = url.startsWith('data:') ? `${url.slice(0, 80)}... len=${url.length}` : url;
      console.error(`[messaging diagnostic][requestfailed] ${safeUrl} :: ${request.failure()?.errorText || 'unknown error'}`);
    });

    return page;
  };

  return browser;
};

await import('./messaging-loop.mjs');
