/**
 * Playwright Helper Functions for UI Automation
 * Handles browser automation for critical flows: shipments, receive confirmation, UI validation
 */

const { chromium } = require('playwright');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const HEADLESS = process.env.HEADLESS !== 'false'; // Default headless, set HEADLESS=false for debugging
const TIMEOUT = 30000; // 30s per action

let browser = null;

/**
 * START BROWSER
 * Launches Playwright browser instance (reused across tests)
 */
async function startBrowser() {
  try {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    console.log(`✓ Browser started (headless: ${HEADLESS})`);
    return browser;
  } catch (error) {
    console.error('✗ Failed to start browser:', error.message);
    throw error;
  }
}

/**
 * STOP BROWSER
 * Gracefully closes browser
 */
async function stopBrowser() {
  try {
    if (browser) {
      await browser.close();
      console.log('✓ Browser closed');
    }
  } catch (error) {
    console.error('✗ Failed to close browser:', error.message);
  }
}

/**
 * CREATE NEW PAGE CONTEXT
 * Returns a new browser page (tab)
 */
async function createPage() {
  if (!browser) {
    await startBrowser();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  console.log('✓ New page context created');
  return page;
}

/**
 * NAVIGATE TO SHIPMENT CREATION PAGE
 */
async function navigateToShipments(page) {
  try {
    await page.goto(`${FRONTEND_URL}/shipments`, { waitUntil: 'networkidle' });
    console.log('  ✓ Navigated to shipments page');
  } catch (error) {
    console.error('  ✗ Failed to navigate to shipments:', error.message);
    throw error;
  }
}

/**
 * CREATE SHIPMENT VIA UI
 * Fills form, submits, and returns shipment ID
 * @param {Page} page - Playwright page
 * @param {string} fromStoreId - Source store ID
 * @param {string} toStoreId - Destination store ID
 * @param {array} items - [{spare_part_id, quantity}, ...]
 * @returns {Promise<string>} Shipment ID from response or URL
 */
async function createShipmentViaUI(page, fromStoreId, toStoreId, items) {
  try {
    console.log('  [UI] Creating shipment via form...');
    
    // Wait for form to load
    await page.waitForSelector('form, [role="form"]', { timeout: TIMEOUT });

    // Fill "From Store" dropdown
    const fromStoreSelect = await page.$('select[name="from_store_id"], [data-test="from-store"]');
    if (fromStoreSelect) {
      await fromStoreSelect.selectOption(fromStoreId);
      console.log(`    ✓ Selected from store: ${fromStoreId}`);
    }

    // Fill "To Store" dropdown
    const toStoreSelect = await page.$('select[name="to_store_id"], [data-test="to-store"]');
    if (toStoreSelect) {
      await toStoreSelect.selectOption(toStoreId);
      console.log(`    ✓ Selected to store: ${toStoreId}`);
    }

    // Add shipment items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Click "Add Item" button if available
      const addItemBtn = await page.$('button[data-test="add-item"], button:has-text("Add Item")');
      if (addItemBtn && i > 0) {
        await addItemBtn.click();
        await page.waitForTimeout(500); // Brief pause for form to render
      }

      // Fill spare part selector (nth item)
      const spareSelectors = await page.$$('select[name*="spare_part"], select[data-test*="spare"]');
      if (spareSelectors[i]) {
        await spareSelectors[i].selectOption(item.spare_part_id);
        console.log(`    ✓ Added spare part: ${item.spare_part_id}`);
      }

      // Fill quantity input (nth item)
      const quantityInputs = await page.$$('input[name*="quantity"], input[data-test*="quantity"]');
      if (quantityInputs[i]) {
        await quantityInputs[i].fill(String(item.quantity));
        console.log(`    ✓ Set quantity: ${item.quantity}`);
      }
    }

    // Submit form
    const submitBtn = await page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Create")');
    if (!submitBtn) {
      throw new Error('Submit button not found');
    }
    
    // Wait for navigation/modal close after submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
      submitBtn.click(),
    ]);

    console.log('    ✓ Form submitted');

    // Extract shipment ID from URL or response
    const currentUrl = page.url();
    const shipmentIdMatch = currentUrl.match(/shipment[s]?\/([a-f0-9-]+)/i);
    const shipmentId = shipmentIdMatch ? shipmentIdMatch[1] : null;

    if (!shipmentId) {
      console.warn('    ⚠ Could not extract shipment ID from URL');
      // Fallback: check if there's a success message with ID
    }

    return shipmentId;
  } catch (error) {
    console.error('  ✗ Shipment creation failed:', error.message);
    throw error;
  }
}

/**
 * NAVIGATE TO INCOMING SHIPMENTS
 */
async function navigateToIncomingShipments(page) {
  try {
    await page.goto(`${FRONTEND_URL}/incoming-shipments`, { waitUntil: 'networkidle' });
    console.log('  ✓ Navigated to incoming shipments page');
  } catch (error) {
    console.error('  ✗ Failed to navigate:', error.message);
    throw error;
  }
}

/**
 * FIND SHIPMENT BY ID IN TABLE
 * Searches for shipment in list view and returns row element
 */
async function findShipmentInTable(page, shipmentId) {
  try {
    await page.waitForSelector('table, [role="grid"]', { timeout: TIMEOUT });
    
    // Look for row containing shipment ID
    const row = await page.locator(`tr:has-text("${shipmentId}"), [data-test="shipment-${shipmentId}"]`).first();
    
    if (!row) {
      throw new Error(`Shipment ${shipmentId} not found in table`);
    }
    
    console.log(`  ✓ Found shipment ${shipmentId} in table`);
    return row;
  } catch (error) {
    console.error(`  ✗ Failed to find shipment: ${error.message}`);
    throw error;
  }
}

/**
 * CLICK CONFIRM RECEIVE BUTTON
 * Finds and clicks the "Confirm Receive" action for a shipment row
 */
async function clickConfirmReceive(page, shipmentRow) {
  try {
    const confirmBtn = await shipmentRow.locator('button:has-text("Confirm"), button:has-text("Receive"), [data-test="confirm-receive"]').first();
    
    if (!confirmBtn) {
      throw new Error('Confirm Receive button not found');
    }

    await confirmBtn.click();
    console.log('  ✓ Clicked "Confirm Receive" button');
    
    // Wait for modal to appear
    await page.waitForSelector('dialog, [role="dialog"], .modal', { timeout: TIMEOUT });
    console.log('  ✓ Receive confirmation modal appeared');
  } catch (error) {
    console.error('  ✗ Failed to click confirm button:', error.message);
    throw error;
  }
}

/**
 * FILL RECEIVE CONFIRMATION MODAL
 * Fills receiver name and phone in confirmation dialog
 */
async function fillReceiveModal(page, receiverName = 'Auto Tester', phone = '9999999999') {
  try {
    // Fill receiver name
    const nameInput = await page.$('input[name="receiver_name"], input[data-test="receiver-name"]');
    if (nameInput) {
      await nameInput.fill(receiverName);
      console.log(`  ✓ Filled receiver name: ${receiverName}`);
    }

    // Fill phone
    const phoneInput = await page.$('input[name="phone"], input[data-test="receiver-phone"]');
    if (phoneInput) {
      await phoneInput.fill(phone);
      console.log(`  ✓ Filled phone: ${phone}`);
    }

    // Submit modal
    const submitBtn = await page.$('button[type="submit"]:visible, button:has-text("Confirm"), button:has-text("Submit")');
    if (!submitBtn) {
      throw new Error('Submit button in modal not found');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
      submitBtn.click(),
    ]);

    console.log('  ✓ Receive confirmation submitted');

    // Verify modal closed
    await page.waitForTimeout(1000); // Brief pause for modal to close
    const modalStillOpen = await page.$('dialog:visible, [role="dialog"]:visible')
      .then(() => true)
      .catch(() => false);

    if (!modalStillOpen) {
      console.log('  ✓ Confirmation modal closed');
    }
  } catch (error) {
    console.error('  ✗ Failed to fill/submit receive modal:', error.message);
    throw error;
  }
}

/**
 * VERIFY SHIPMENT STATUS IN UI
 * Checks if shipment row displays correct status
 */
async function verifyShipmentStatus(page, shipmentId, expectedStatus) {
  try {
    const row = await findShipmentInTable(page, shipmentId);
    const statusCell = await row.locator('[data-test="status"], td:nth-child(3)').first();
    
    if (!statusCell) {
      console.warn(`  ⚠ Could not locate status cell for shipment ${shipmentId}`);
      return false;
    }

    const statusText = await statusCell.textContent();
    const matches = statusText.toLowerCase().includes(expectedStatus.toLowerCase());

    if (matches) {
      console.log(`  ✓ Status verified: ${statusText} contains "${expectedStatus}"`);
      return true;
    } else {
      console.error(`  ✗ Status mismatch: expected "${expectedStatus}", got "${statusText}"`);
      return false;
    }
  } catch (error) {
    console.error(`  ✗ Failed to verify status: ${error.message}`);
    throw error;
  }
}

/**
 * CHECK INVENTORY TABLE FOR STOCK QUANTITY
 * Navigates to store inventory and verifies stock amount
 */
async function verifyStoreInventory(page, storeId, sparePartName, expectedQuantity) {
  try {
    await page.goto(`${FRONTEND_URL}/stores/${storeId}/inventory`, { waitUntil: 'networkidle' });
    
    // Look for row with spare part name
    const row = await page.locator(`tr:has-text("${sparePartName}"), [data-test="inventory-${sparePartName}"]`).first();
    
    if (!row) {
      throw new Error(`Spare part "${sparePartName}" not found in inventory`);
    }

    // Extract quantity from row
    const quantityCell = await row.locator('[data-test="quantity"], td:nth-child(2)').first();
    const quantityText = await quantityCell.textContent();
    const actualQuantity = parseInt(quantityText, 10);

    console.log(`  [Inventory] ${sparePartName}: ${actualQuantity} (expected: ${expectedQuantity})`);

    if (actualQuantity === expectedQuantity) {
      console.log('  ✓ Inventory quantity verified');
      return true;
    } else {
      console.error(`  ✗ Inventory mismatch: expected ${expectedQuantity}, got ${actualQuantity}`);
      return false;
    }
  } catch (error) {
    console.error(`  ✗ Failed to verify inventory: ${error.message}`);
    throw error;
  }
}

/**
 * SCREENSHOT for debugging
 */
async function takeScreenshot(page, filename = 'debug.png') {
  try {
    await page.screenshot({ path: filename });
    console.log(`  ✓ Screenshot saved: ${filename}`);
  } catch (error) {
    console.warn(`  ⚠ Failed to save screenshot: ${error.message}`);
  }
}

module.exports = {
  startBrowser,
  stopBrowser,
  createPage,
  navigateToShipments,
  createShipmentViaUI,
  navigateToIncomingShipments,
  findShipmentInTable,
  clickConfirmReceive,
  fillReceiveModal,
  verifyShipmentStatus,
  verifyStoreInventory,
  takeScreenshot,
};
