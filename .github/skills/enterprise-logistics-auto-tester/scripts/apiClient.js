/**
 * API Client - HTTP wrapper with retry logic and helper methods
 * Provides methods for creating/managing stores, machines, spare parts, inventory, shipments
 */

const fetch = require('node-fetch');
const config = require('./config');
const logger = require('./logger');

class APIClient {
  constructor(baseUrl = config.api.baseUrl) {
    this.baseUrl = baseUrl;
    this.timeout = config.api.timeout;
    this.retryAttempts = config.api.retryAttempts;
    this.retryDelay = config.api.retryDelay;
  }

  /**
   * Make an HTTP request with automatic retry on failure
   */
  async request(method, endpoint, payload = null, attempt = 1) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: this.timeout,
    };

    if (payload) {
      options.body = JSON.stringify(payload);
    }

    try {
      logger.debug(`[Attempt ${attempt}] ${method} ${endpoint}`);
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data.message || response.statusText}`
        );
      }

      logger.debug(`✓ ${method} ${endpoint} (${response.status})`);
      return data;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.warn(
          `Request failed (attempt ${attempt}/${this.retryAttempts}): ${error.message}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request(method, endpoint, payload, attempt + 1);
      }

      logger.error(
        `✗ ${method} ${endpoint} - Failed after ${this.retryAttempts} attempts: ${error.message}`
      );
      throw error;
    }
  }

  // =====================
  // STORES
  // =====================

  async createStore(name, location = '') {
    const payload = {
      name,
      location: location || name.toLowerCase(),
    };
    const result = await this.request('POST', '/stores', payload);
    logger.info(`✓ Created store: ${name} (ID: ${result._id || result.id})`);
    return result;
  }

  async getStore(storeId) {
    return this.request('GET', `/stores/${storeId}`);
  }

  async listStores() {
    return this.request('GET', '/stores');
  }

  async deleteStore(storeId) {
    return this.request('DELETE', `/stores/${storeId}`);
  }

  // =====================
  // MACHINES
  // =====================

  async createMachine(storeId, name, model = '') {
    const payload = {
      name,
      store_id: storeId,
      model: model || `Model-${name}`,
    };
    const result = await this.request('POST', '/machines', payload);
    logger.info(`✓ Created machine: ${name} in store ${storeId} (ID: ${result._id || result.id})`);
    return result;
  }

  async getMachine(machineId) {
    return this.request('GET', `/machines/${machineId}`);
  }

  async listMachinesByStore(storeId) {
    return this.request('GET', `/machines?store_id=${storeId}`);
  }

  async assignSparePartToMachine(machineId, sparePartId) {
    const payload = { spare_part_id: sparePartId };
    const result = await this.request(
      'POST',
      `/machines/${machineId}/spares`,
      payload
    );
    logger.info(`✓ Assigned spare part ${sparePartId} to machine ${machineId}`);
    return result;
  }

  // =====================
  // SPARE PARTS
  // =====================

  async createSparePart(name, category = 'General') {
    const payload = {
      name,
      category,
    };
    const result = await this.request('POST', '/spare-parts', payload);
    logger.info(`✓ Created spare part: ${name} (ID: ${result._id || result.id})`);
    return result;
  }

  async getSparePart(sparePartId) {
    return this.request('GET', `/spare-parts/${sparePartId}`);
  }

  async listSpareParts() {
    return this.request('GET', '/spare-parts');
  }

  // =====================
  // INVENTORY
  // =====================

  async addInventory(storeId, sparePartId, quantity, minThreshold = 10) {
    const payload = {
      store_id: storeId,
      spare_part_id: sparePartId,
      quantity,
      min_threshold: minThreshold,
    };
    const result = await this.request('POST', '/inventory', payload);
    logger.info(
      `✓ Added inventory: ${quantity} units of spare part ${sparePartId} to store ${storeId}`
    );
    return result;
  }

  async getInventory(storeId) {
    return this.request('GET', `/inventory?store_id=${storeId}`);
  }

  async getInventoryBySpare(sparePartId) {
    return this.request('GET', `/inventory?spare_part_id=${sparePartId}`);
  }

  async updateInventoryQuantity(inventoryId, quantity) {
    const payload = { quantity };
    return this.request('PUT', `/inventory/${inventoryId}`, payload);
  }

  // =====================
  // SHIPMENTS (Inter-Store Transfers)
  // =====================

  async createShipment(fromStoreId, toStoreId, items) {
    const payload = {
      from_store_id: fromStoreId,
      to_store_id: toStoreId,
      items: items, // Array of { spare_part_id, quantity }
    };
    const result = await this.request('POST', '/shipments', payload);
    logger.info(
      `✓ Created shipment from store ${fromStoreId} to store ${toStoreId} (ID: ${result._id || result.id})`
    );
    return result;
  }

  async getShipment(shipmentId) {
    return this.request('GET', `/shipments/${shipmentId}`);
  }

  async listShipments(query = '') {
    return this.request('GET', `/shipments${query}`);
  }

  async listOutgoingShipments(storeId) {
    return this.request('GET', `/shipments?from_store_id=${storeId}`);
  }

  async listIncomingShipments(storeId) {
    return this.request('GET', `/shipments?to_store_id=${storeId}`);
  }

  async confirmReceiveShipment(shipmentId, receiverName, receiverPhone) {
    const payload = {
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
    };
    const result = await this.request(
      'POST',
      `/shipments/${shipmentId}/confirm-receive`,
      payload
    );
    logger.info(`✓ Confirmed receipt of shipment ${shipmentId}`);
    return result;
  }

  // =====================
  // INCOMING SHIPMENTS
  // =====================

  async createIncomingShipment(toStoreId, items, source = 'External') {
    const payload = {
      to_store_id: toStoreId,
      source,
      items: items, // Array of { spare_part_id, quantity }
    };
    const result = await this.request('POST', '/incoming-shipments', payload);
    logger.info(
      `✓ Created incoming shipment to store ${toStoreId} from ${source} (ID: ${result._id || result.id})`
    );
    return result;
  }

  async getIncomingShipment(shipmentId) {
    return this.request('GET', `/incoming-shipments/${shipmentId}`);
  }

  async confirmReceiveIncomingShipment(shipmentId, receiverName, receiverPhone) {
    const payload = {
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
    };
    const result = await this.request(
      'POST',
      `/incoming-shipments/${shipmentId}/confirm-receive`,
      payload
    );
    logger.info(`✓ Confirmed receipt of incoming shipment ${shipmentId}`);
    return result;
  }

  // =====================
  // HEALTH CHECK
  // =====================

  async healthCheck() {
    try {
      const result = await this.request('GET', '/health');
      logger.info('✓ API is healthy');
      return result;
    } catch (error) {
      logger.error(`✗ API health check failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = APIClient;
