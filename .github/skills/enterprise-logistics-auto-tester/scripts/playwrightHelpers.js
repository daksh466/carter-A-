/**
 * Playwright Helpers - UI automation for critical flows
 * Handles shipment creation, confirm receive, and status validation
 */

const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./logger');

class PlaywrightHelpers {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = config.frontend.baseUrl;
    this.timeout = config.frontend.timeout;
  }

  /**
   * Launch browser and navigate to app
   */
  async launch() {
    try {
      logger.info('Launching Playwright browser...');
      this.browser = await chromium.launch({
        headless: config.frontend.headless,
      });
      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(this.timeout);

      logger.info(`✓ Browser launched, navigating to ${this.baseUrl}`);
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      logger.info('✓ App loaded in browser');
    } catch (error) {
      logger.error(`✗ Failed to launch browser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('✓ Browser closed');
      }
    } catch (error) {
      logger.warn(`Warning: Failed to close browser: ${error.message}`);
    }
  }

  /**
   * Wait for element and take screenshot for debugging
   */
  async waitForElement(selector, timeout = this.timeout) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      logger.debug(`✓ Found element: ${selector}`);
      return await this.page.$(selector);
    } catch (error) {
      logger.error(`✗ Element not found: ${selector}`);
      const screenshot = `./reports/test-results/screenshot-${Date.now()}.png`;
      await this.page.screenshot({ path: screenshot });
      logger.error(`Screenshot saved to ${screenshot}`);
      throw error;
    }
  }

  /**
   * Create shipment through UI
   * Assumes user is on Shipments page
   */
  async createShipmentUI(fromStore, toStore, items) {
    try {
      logger.info(`UI: Creating shipment ${fromStore} → ${toStore}`);

      // Click "Create Shipment" button
      await this.waitForElement('button[data-testid="create-shipment"]');
      await this.page.click('button[data-testid="create-shipment"]');

      // Wait for modal
      await this.waitForElement('div[role="dialog"]');
      logger.debug('✓ Shipment modal opened');

      // Select from store
      await this.page.selectOption(
        'select[data-testid="from-store"]',
        fromStore
      );
      logger.debug(`✓ Selected from store: ${fromStore}`);

      // Select to store
      await this.page.selectOption('select[data-testid="to-store"]', toStore);
      logger.debug(`✓ Selected to store: ${toStore}`);

      // Add items
      for (let i = 0; i < items.length; i++) {
        const { sparePart, quantity } = items[i];

        // Click "Add Item" button if not first item
        if (i > 0) {
          await this.page.click('button[data-testid="add-item"]');
          // Wait for new item row
          await this.page.waitForSelector(
            `input[data-testid="item-${i}-spare-part"]`,
            { timeout: 5000 }
          );
        }

        // Select spare part
        await this.page.selectOption(
          `select[data-testid="item-${i}-spare-part"]`,
          sparePart
        );
        logger.debug(`✓ Selected spare part: ${sparePart}`);

        // Enter quantity
        await this.page.fill(
          `input[data-testid="item-${i}-quantity"]`,
          quantity.toString()
        );
        logger.debug(`✓ Entered quantity: ${quantity}`);
      }

      // Submit form
      await this.page.click('button[data-testid="submit-shipment"]');
      logger.info(`✓ UI: Shipment created ${fromStore} → ${toStore}`);

      // Wait for success message or redirect
      await this.page.waitForNavigation({ timeout: 10000 });
      return true;
    } catch (error) {
      logger.error(`✗ UI: Failed to create shipment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Confirm receive shipment through UI
   * Navigates to incoming shipments and confirms receipt
   */
  async confirmReceiveUI(shipmentId, receiverName, receiverPhone) {
    try {
      logger.info(`UI: Confirming receive for shipment ${shipmentId}`);

      // Navigate to shipments page
      await this.page.goto(`${this.baseUrl}/shipments`, {
        waitUntil: 'networkidle',
      });
      logger.debug('✓ Navigated to shipments page');

      // Find shipment row by ID
      const shipmentRow = await this.page.$(`tr[data-testid="shipment-${shipmentId}"]`);
      if (!shipmentRow) {
        throw new Error(`Shipment row not found for ID: ${shipmentId}`);
      }

      // Click "Confirm Receive" button in row
      const confirmBtn = await shipmentRow.$(
        'button[data-testid="confirm-receive"]'
      );
      if (!confirmBtn) {
        throw new Error('Confirm Receive button not found');
      }

      await confirmBtn.click();
      logger.debug('✓ Clicked Confirm Receive button');

      // Wait for modal
      await this.waitForElement('div[data-testid="confirm-receive-modal"]');

      // Enter receiver name
      await this.page.fill(
        'input[data-testid="receiver-name"]',
        receiverName
      );
      logger.debug(`✓ Entered receiver name: ${receiverName}`);

      // Enter receiver phone
      await this.page.fill(
        'input[data-testid="receiver-phone"]',
        receiverPhone
      );
      logger.debug(`✓ Entered receiver phone: ${receiverPhone}`);

      // Submit
      await this.page.click(
        'button[data-testid="submit-confirm-receive"]'
      );
      logger.info(`✓ UI: Confirmed receive for shipment ${shipmentId}`);

      // Wait for modal to close or page update
      await this.page.waitForTimeout(2000);
      return true;
    } catch (error) {
      logger.error(`✗ UI: Failed to confirm receive: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate table row exists with expected values
   */
  async validateTableRow(tableSelector, filters = {}) {
    try {
      logger.debug(`Validating table row with filters:`, filters);

      // Build XPath based on filters
      let xpathParts = [];
      for (const [key, value] of Object.entries(filters)) {
        xpathParts.push(
          `contains(@data-testid, '${key}') and contains(text(), '${value}')`
        );
      }

      const xpath = `//${tableSelector}/td[${xpathParts.join(' and ')}]`;
      const elements = await this.page.$$(xpath);

      if (elements.length === 0) {
        throw new Error(`Table row not found matching filters: ${JSON.stringify(filters)}`);
      }

      logger.debug(`✓ Found table row with expected values`);
      return true;
    } catch (error) {
      logger.error(`✗ Table validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all table rows as JSON
   */
  async extractTableData(tableSelector) {
    try {
      const data = await this.page.evaluate((selector) => {
        const rows = document.querySelectorAll(`${selector} tbody tr`);
        return Array.from(rows).map((row) => {
          const cells = row.querySelectorAll('td');
          return Array.from(cells).map((cell) => cell.innerText);
        });
      }, tableSelector);

      logger.debug(`✓ Extracted ${data.length} rows from table`);
      return data;
    } catch (error) {
      logger.error(`✗ Failed to extract table data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify shipment status in UI
   */
  async verifyShipmentStatus(shipmentId, expectedStatus) {
    try {
      const status = await this.page.locator(
        `tr[data-testid="shipment-${shipmentId}"] [data-testid="status"]`
      ).innerText();

      if (!status.includes(expectedStatus)) {
        throw new Error(
          `Expected status "${expectedStatus}" but found "${status}"`
        );
      }

      logger.info(
        `✓ Verified shipment ${shipmentId} status: ${expectedStatus}`
      );
      return true;
    } catch (error) {
      logger.error(`✗ Status verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for page to be interactive
   */
  async waitForPageReady() {
    try {
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(500); // Extra buffer
      logger.debug('✓ Page is ready');
    } catch (error) {
      logger.warn(`Warning: Page readiness check timed out: ${error.message}`);
    }
  }

  /**
   * Take screenshot for debugging
   */
  async screenshot(name) {
    try {
      const filename = `./reports/test-results/screenshot-${name}-${Date.now()}.png`;
      await this.page.screenshot({ path: filename });
      logger.debug(`✓ Screenshot saved: ${filename}`);
      return filename;
    } catch (error) {
      logger.warn(`Warning: Failed to take screenshot: ${error.message}`);
    }
  }
}

module.exports = PlaywrightHelpers;
