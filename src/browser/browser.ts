import {
  Browser as PuppeteerBrowser,
  BrowserContext,
  KeyInput,
  Page,
} from 'puppeteer';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as process from 'process';

const LOGGER = new Logger('Browser');

const PATH_TO_EXTENSION = path.join(process.cwd(), 'browser-extension');
const EXTENSION_ID = 'jjndjgheafjngoipoacpjgeicjeomjli';

export class Browser {
  public peerId: string;
  private page: Page;

  constructor(
    private browser: PuppeteerBrowser,
    // private browser: BrowserContext,
    public readonly url: string,
  ) {}

  public async open(): Promise<string> {
    LOGGER.debug(`Opening page with url: ${this.url}`);
    this.page = await this.browser.newPage();

    await installMouseHelper(this.page);

    await this.page.goto(this.url);
    await this.page.setViewport({ width: 1920, height: 1080 });

    this.page.on('load', async () => {
      /**
       * For some reason every a time a page is loaded (e.g. after clicking a link)
       * the viewport size needs to be set again. Otherwise, there are black bars
       * at the top and bottom of the page.
       */
      await this.page.setViewport({ width: 1920, height: 1080 });
    });

    const extensionPage = await this.browser.newPage();
    await extensionPage.setBypassCSP(true);
    await extensionPage.goto(`chrome-extension://${EXTENSION_ID}/options.html`);

    await this.page.bringToFront();

    const id = await extensionPage.evaluate(async () => {
      console.log('hello world');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return await START_RECORDING();
    });

    LOGGER.debug(`Recording started with id: ${id}`);

    this.peerId = id;
    return id;
  }

  public async openWebsite(url: string): Promise<void> {
    await this.page.goto(url);
  }

  public async moveMouse(x: number, y: number): Promise<void> {
    await this.page.mouse.move(x, y);
  }

  public async mouseDown(): Promise<void> {
    await this.page.mouse.down();
  }

  public async mouseUp(): Promise<void> {
    await this.page.mouse.up();
  }

  public async keyDown(key: string): Promise<void> {
    await this.page.keyboard.down(key as KeyInput);
  }

  public async keyUp(key: string): Promise<void> {
    await this.page.keyboard.up(key as KeyInput);
  }

  public async scroll(deltaY: number): Promise<void> {
    await this.page.mouse.wheel({ deltaY });
  }

  public async reload(): Promise<void> {
    await this.page.reload();
  }

  public async navigateBack(): Promise<void> {
    await this.page.goBack();
  }

  public async navigateForward(): Promise<void> {
    await this.page.goForward();
  }

  public async close(): Promise<void> {
    if (this.browser) {
      LOGGER.debug('Closing browser');
      await this.browser.close();
    }
  }
}

async function installMouseHelper(page) {
  await page.evaluateOnNewDocument(() => {
    // Install mouse helper only for top-level frame.
    if (window !== window.parent) {
      return;
    }
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        const box = document.createElement('puppeteer-mouse-pointer');
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
        puppeteer-mouse-pointer {
          pointer-events: none;
          position: absolute;
          top: 0;
          z-index: 10000;
          left: 0;
          width: 20px;
          height: 20px;
          background: rgba(0,0,0,.4);
          border: 1px solid white;
          border-radius: 10px;
          margin: -10px 0 0 -10px;
          padding: 0;
          transition: background .2s, border-radius .2s, border-color .2s;
        }
        puppeteer-mouse-pointer.button-1 {
          transition: none;
          background: rgba(0,0,0,0.9);
        }
        puppeteer-mouse-pointer.button-2 {
          transition: none;
          border-color: rgba(0,0,255,0.9);
        }
        puppeteer-mouse-pointer.button-3 {
          transition: none;
          border-radius: 4px;
        }
        puppeteer-mouse-pointer.button-4 {
          transition: none;
          border-color: rgba(255,0,0,0.9);
        }
        puppeteer-mouse-pointer.button-5 {
          transition: none;
          border-color: rgba(0,255,0,0.9);
        }
      `;
        document.head.appendChild(styleElement);
        document.body.appendChild(box);
        document.addEventListener(
          'mousemove',
          (event) => {
            box.style.left = event.pageX + 'px';
            box.style.top = event.pageY + 'px';
            updateButtons(event.buttons);
          },
          true,
        );
        document.addEventListener(
          'mousedown',
          (event) => {
            updateButtons(event.buttons);
            box.classList.add('button-' + event.which);
          },
          true,
        );
        document.addEventListener(
          'mouseup',
          (event) => {
            updateButtons(event.buttons);
            box.classList.remove('button-' + event.which);
          },
          true,
        );
        function updateButtons(buttons) {
          for (let i = 0; i < 5; i++) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            box.classList.toggle('button-' + i, buttons & (1 << i));
          }
        }
      },
      false,
    );
  });
}
