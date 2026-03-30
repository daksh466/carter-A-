/**
 * API Helper Functions for Enterprise Logistics Auto Tester
 * Wraps HTTP calls with retry logic, error handling, and response validation
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || '';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Custom HTTP client with retry logic and auto-error handling
 */
class APIClient {
  constructor(baseURL = API_BASE_URL) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (API_AUTH_TOKEN) {
      headers.Authorization = `Bearer ${API_AUTH_TOKEN}`;
    }

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers,
    });
  }

  _formatError(error) {
    const status = error?.response?.status;
    const payload = error?.response?.data;
    const apiMsg = payload?.message || payload?.error || '';
    const details = payload?.errors ? ` | details: ${JSON.stringify(payload.errors)}` : '';
    if (status) {
      return `HTTP ${status}${apiMsg ? `: ${apiMsg}` : ''}${details}`;
    }
    return error?.message || 'Unknown network error';
  }

  /**
   * HTTP POST with retry logic
   * @param {string} endpoint - API path
   * @param {object} payload - Request body
   * @returns {Promise<object>} Response data
   * @throws {Error} After MAX_RETRIES failures
   */
  async post(endpoint, payload) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.post(endpoint, payload);
        console.log(`✓ POST ${endpoint} (attempt ${attempt}) →`, response.data);
        return response.data;
      } catch (error) {
        lastError = error;
        const formatted = this._formatError(error);
        if (attempt < MAX_RETRIES) {
          console.warn(`POST ${endpoint} attempt ${attempt} failed, retrying...`, formatted);
          await this._delay(RETRY_DELAY * attempt); // Exponential backoff
        }
      }
    }
    throw new Error(`POST ${endpoint} failed after ${MAX_RETRIES} retries: ${this._formatError(lastError)}`);
  }

  async patch(endpoint, payload) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.patch(endpoint, payload);
        console.log(`PATCH ${endpoint} (attempt ${attempt})`);
        return response.data;
      } catch (error) {
        lastError = error;
        const formatted = this._formatError(error);
        if (attempt < MAX_RETRIES) {
          console.warn(`PATCH ${endpoint} attempt ${attempt} failed, retrying...`, formatted);
          await this._delay(RETRY_DELAY * attempt);
        }
      }
    }
    throw new Error(`PATCH ${endpoint} failed after ${MAX_RETRIES} retries: ${this._formatError(lastError)}`);
  }

  /**
   * HTTP GET with retry logic
   */
  async get(endpoint) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.get(endpoint);
        console.log(`✓ GET ${endpoint} (attempt ${attempt})`);
        return response.data;
      } catch (error) {
        lastError = error;
        const formatted = this._formatError(error);
        if (attempt < MAX_RETRIES) {
          console.warn(`GET ${endpoint} attempt ${attempt} failed, retrying...`, formatted);
          await this._delay(RETRY_DELAY * attempt);
        }
      }
    }
    throw new Error(`GET ${endpoint} failed after ${MAX_RETRIES} retries: ${this._formatError(lastError)}`);
  }

  /**
   * HTTP PUT with retry logic
   */
  async put(endpoint, payload) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.put(endpoint, payload);
        console.log(`✓ PUT ${endpoint} (attempt ${attempt})`);
        return response.data;
      } catch (error) {
        lastError = error;
        const formatted = this._formatError(error);
        if (attempt < MAX_RETRIES) {
          console.warn(`PUT ${endpoint} attempt ${attempt} failed, retrying...`, formatted);
          await this._delay(RETRY_DELAY * attempt);
        }
      }
    }
    throw new Error(`PUT ${endpoint} failed after ${MAX_RETRIES} retries: ${this._formatError(lastError)}`);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Domain-specific API operations
 */
class LogisticsAPI {
  constructor(baseURL = API_BASE_URL) {
    this.client = new APIClient(baseURL);
  }

  _extractData(result) {
    if (!result || typeof result !== 'object') return result;
    if (result.data && typeof result.data === 'object') return result.data;
    return result;
  }

  /**
   * CREATE STORE
   * @param {string} name - Store name (e.g., "Store_A")
   * @param {object} options - Additional fields (location, phone, etc.)
   * @returns {Promise<object>} Created store with ID
   */
  async createStore(name, options = {}) {
    const payload = {
      state: options.state || `State-${name}`,
      storeHead: options.storeHead || name,
      contact: options.contact || options.phone || '1234567890',
      name,
      address: options.location || `Location-${name}`,
      phone: options.phone || '1234567890',
      ...options,
    };
    const result = await this.client.post('/api/stores', payload);
    const data = this._extractData(result);
    if (!data?.id && !data?._id) {
      throw new Error(`Store creation failed: no ID returned. Response: ${JSON.stringify(result)}`);
    }
    const storeId = data.id || data._id;
    console.log(`  [Store] Created ${name} with ID: ${storeId}`);
    return { id: storeId, ...data };
  }

  /**
   * CREATE MACHINE
   * @param {string} storeId - Parent store ID
   * @param {string} name - Machine name (e.g., "Lathe-1")
   * @param {object} options - model, type, etc.
   * @returns {Promise<object>} Created machine with ID
   */
  async createMachine(storeId, name, options = {}) {
    const payload = {
      name,
      store_id: storeId,
      quantity_available: Number(options.quantity_available ?? 20),
      minimum_required: Number(options.minimum_required ?? 5),
      warranty_expiry_date: options.warranty_expiry_date || null,
      ...options,
    };
    const result = await this.client.post('/api/machines', payload);
    const machine = this._extractData(result)?.machine || this._extractData(result);
    if (!machine?.id && !machine?._id) {
      throw new Error(`Machine creation failed: no ID returned. Response: ${JSON.stringify(result)}`);
    }
    const machineId = machine.id || machine._id;
    console.log(`  [Machine] Created ${name} in store ${storeId} with ID: ${machineId}`);
    return { id: machineId, ...machine };
  }

  /**
   * CREATE SPARE PART
   * @param {string} name - Part name (e.g., "Bearing 6201 Small")
   * @param {object} options - category, unit, cost, etc.
   * @returns {Promise<object>} Created spare part with ID
   */
  async createSparePart(name, options = {}) {
    if (!options.machine_id || !options.store_id) {
      throw new Error('Spare part creation requires machine_id and store_id for this backend');
    }

    const payload = {
      name,
      size: options.size || 'std',
      type: options.type || 'general',
      unit: options.unit || 'pcs',
      machine_id: options.machine_id,
      store_id: options.store_id,
      quantity_available: Number(options.quantity_available ?? 10),
      minimum_required: Number(options.minimum_required ?? 2),
      warranty_expiry_date: options.warranty_expiry_date || null,
      ...options,
    };
    const result = await this.client.post('/api/spares', payload);
    const spare = this._extractData(result)?.sparePart || this._extractData(result);
    if (!spare?.id && !spare?._id) {
      throw new Error(`Spare part creation failed: no ID returned. Response: ${JSON.stringify(result)}`);
    }
    const partId = spare.id || spare._id;
    console.log(`  [SparePart] Created ${name} with ID: ${partId}`);
    return { id: partId, ...spare };
  }

  /**
   * ASSIGN SPARE PART TO MACHINE
   * @param {string} machineId - Machine ID
   * @param {string} sparePartId - Spare part ID
   * @returns {Promise<object>} Assignment result
   */
  async assignSpareToMachine(machineId, sparePartId) {
    // Current backend links spare->machine at creation time via machine_id.
    console.log(`  [Assignment] Existing link assumed for spare ${sparePartId} to machine ${machineId}`);
    return { success: true, machineId, sparePartId };
  }

  /**
   * SEED INVENTORY for a store
   * @param {string} storeId - Store ID
   * @param {array} items - [{spare_part_id, quantity, min_threshold}, ...]
   * @returns {Promise<array>} Created inventory records
   */
  async seedInventory(storeId, items) {
    // Inventory is represented by spare rows in this backend.
    const results = items.map((item) => ({
      store_id: storeId,
      spare_part_id: item.spare_part_id,
      quantity: item.quantity,
      minimum_required: item.min_threshold || 5,
      note: 'Inventory seeded when spare part was created',
    }));
    console.log(`  [Inventory] Using pre-seeded spare rows for store ${storeId}`);
    return results;
  }

  /**
   * CREATE OUTGOING SHIPMENT (inter-store transfer)
   * @param {string} fromStoreId - Source store
   * @param {string} toStoreId - Destination store
   * @param {array} items - [{spare_part_id, quantity}, ...]
   * @returns {Promise<object>} Created shipment with ID
   */
  async createOutgoingShipment(fromStoreId, toStoreId, items) {
    const payload = {
      type: 'internal',
      isInstant: false,
      from_store_id: fromStoreId,
      from_store_name: `Store-${fromStoreId.slice(-4)}`,
      to_store_id: toStoreId,
      to_store_name: `Store-${toStoreId.slice(-4)}`,
      items,
      driver: {
        name: 'Auto Tester Driver',
        phone: '9999999999',
        driverId: `DRV-${Date.now()}`,
      },
      modeOfTransport: 'Truck',
      vehicleNumber: 'AUTO-1234',
      dispatchDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      approvedBy: 'Auto Tester',
      transferredBy: 'Auto Tester',
      status: 'in_transit',
    };
    const result = await this.client.post('/api/transfers', payload);
    const transfer = this._extractData(result)?.transfer || this._extractData(result);
    if (!transfer?.id && !transfer?._id) {
      throw new Error(`Shipment creation failed: no ID returned. Response: ${JSON.stringify(result)}`);
    }
    const shipmentId = transfer.id || transfer._id;
    console.log(`  [Shipment] Created outgoing: ${fromStoreId} → ${toStoreId}, ID: ${shipmentId}`);
    return { id: shipmentId, ...transfer };
  }

  /**
   * CREATE INCOMING SHIPMENT
   * @param {string} toStoreId - Destination store
   * @param {array} items - [{spare_part_id, quantity}, ...]
   * @param {object} options - source_type, source_name, etc.
   * @returns {Promise<object>} Created shipment with ID
   */
  async createIncomingShipment(toStoreId, items, options = {}) {
    const payload = {
      type: 'incoming',
      isInstant: false,
      to_store_id: toStoreId,
      to_store_name: `Store-${toStoreId.slice(-4)}`,
      from_external_name: options.source_name || 'External Supplier',
      items,
      driver: {
        name: 'Auto Tester Driver',
        phone: '9999999999',
        driverId: `DRV-${Date.now()}`,
      },
      modeOfTransport: 'Truck',
      vehicleNumber: 'AUTO-5678',
      dispatchDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      approvedBy: 'Auto Tester',
      transferredBy: 'Auto Tester',
      status: 'in_transit',
    };
    const result = await this.client.post('/api/transfers', payload);
    const transfer = this._extractData(result)?.transfer || this._extractData(result);
    if (!transfer?.id && !transfer?._id) {
      throw new Error(`Incoming shipment creation failed: no ID returned. Response: ${JSON.stringify(result)}`);
    }
    const shipmentId = transfer.id || transfer._id;
    console.log(`  [Shipment] Created incoming: → ${toStoreId}, ID: ${shipmentId}`);
    return { id: shipmentId, ...transfer };
  }

  /**
   * CONFIRM RECEIVE (API call, not UI)
   * @param {string} shipmentId - Incoming shipment ID
   * @param {object} receiverInfo - {receiver_name, phone}
   * @returns {Promise<object>} Updated shipment
   */
  async confirmReceive(shipmentId, receiverInfo = {}) {
    const payload = {
      confirmationBy: receiverInfo.receiver_name || 'Auto Tester',
      receivedBy: receiverInfo.receiver_name || 'Auto Tester',
      confirmedBy: receiverInfo.receiver_name || 'Auto Tester',
      confirmationDate: new Date().toISOString(),
      phone: receiverInfo.phone || '9999999999',
      notes: receiverInfo.notes || 'Auto-confirmed by enterprise logistics auto tester',
    };
    const result = await this.client.patch(`/api/transfers/${shipmentId}/receive`, payload);
    console.log(`  [Receive] Confirmed shipment ${shipmentId}`);
    return result;
  }

  /**
   * GET SHIPMENT by ID
   * @param {string} shipmentId - Shipment ID
   * @returns {Promise<object>} Shipment details
   */
  async getShipment(shipmentId) {
    const result = await this.client.get(`/api/transfers/${shipmentId}`);
    return this._extractData(result)?.transfer || this._extractData(result);
  }

  /**
   * GET STORE INVENTORY
   * @param {string} storeId - Store ID
   * @returns {Promise<array>} Inventory records for store
   */
  async getStoreInventory(storeId) {
    const result = await this.client.get(`/api/spares?storeId=${encodeURIComponent(storeId)}`);
    return this._extractData(result)?.spareParts || [];
  }

  /**
   * GET ALL STORES
   * @returns {Promise<array>} All stores
   */
  async getAllStores() {
    const result = await this.client.get('/api/stores');
    const data = this._extractData(result);
    return Array.isArray(data) ? data : (data?.stores || data?.data || []);
  }

  /**
   * GET ALL MACHINES
   * @returns {Promise<array>} All machines
   */
  async getAllMachines() {
    const result = await this.client.get('/api/machines');
    const data = this._extractData(result);
    return data?.machines || data || [];
  }

  /**
   * GET ALL SPARE PARTS
   * @returns {Promise<array>} All spare parts
   */
  async getAllSpareParts() {
    const result = await this.client.get('/api/spares');
    const data = this._extractData(result);
    return data?.spareParts || data || [];
  }
}

module.exports = { APIClient, LogisticsAPI };
