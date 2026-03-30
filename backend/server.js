const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const path = require('path');
const { randomUUID } = require('crypto');

const models = require('./src/models/index.js');
const { mergeDuplicateSpareParts } = require('./src/utils/sparePartDedup');
const { requireDestructiveAuth, requireDbConnected } = require('./src/middlewares/securityGuards');
const {
  Store,
  Machine,
  SparePart,
  Order,
  PurchaseOrder,
  Transfer
} = models;

const parseMachineIdsFromBody = (body = {}) => {
  const raw = [];

  const arrayCandidates = [body.machines, body.machine_ids, body.machineIds];
  arrayCandidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;
    candidate.forEach((value) => {
      if (value && typeof value === 'object') {
        raw.push(value.id || value._id || value.machineId || value.machine_id || '');
      } else {
        raw.push(value);
      }
    });
  });

  if (body.machine_id) {
    raw.push(body.machine_id);
  }

  return raw
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);
};

const toSparePartApiShape = (part = {}, machineNameById = new Map()) => {
  const machineIdList = [
    ...(Array.isArray(part.machine_ids) ? part.machine_ids : []),
    part.machine_id
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  const machines = machineIdList.map((id) => ({
    id,
    name: machineNameById.get(id) || ''
  }));

  const normalizedPurchaseCost = (() => {
    const candidate = part.purchase_cost ?? part.cost ?? null;
    const numeric = Number(candidate);
    return Number.isNaN(numeric) || numeric < 0 ? null : numeric;
  })();

  const quantity = Number(part.quantity ?? part.quantity_available ?? 0);
  const minRequired = Number(part.minRequired ?? part.minimumRequired ?? part.minimum_required ?? 0);
  const warranty = part.warranty ?? part.warrantyExpiryDate ?? part.warranty_expiry_date ?? null;

  return {
    ...part,
    size: String(part.size || '').trim(),
    unit: String(part.unit || 'pcs').trim(),
    machine_id: machineIdList[0] || '',
    machine_ids: machineIdList,
    machines,
    machine_names: machines.map((item) => item.name).filter(Boolean),
    quantity_available: quantity,
    quantity,
    available_qty: quantity,
    availableQty: quantity,
    minimum_required: minRequired,
    min_required: minRequired,
    minimumRequired: minRequired,
    minRequired: minRequired,
    warranty_expiry_date: warranty,
    warrantyExpiryDate: warranty,
    warranty,
    purchase_cost: normalizedPurchaseCost,
    cost: normalizedPurchaseCost,
    costPrice: normalizedPurchaseCost
  };
};

const toMachineApiShape = (machine = {}) => {
  const expiry = machine.warranty_expiry_date || null;
  const quantity = Number(machine.quantity_available ?? 0);
  const minimumRequired = Number(machine.minimum_required ?? 0);
  return {
    ...machine,
    quantity_available: quantity,
    quantity: quantity,
    minimum_required: minimumRequired,
    minimumRequired,
    minRequired: minimumRequired,
    warranty_expiry_date: expiry,
    warrantyExpiryDate: expiry,
    warranty: expiry,
  };
};

const hydrateSparePartMachineNames = async (parts = []) => {
  const ids = [
    ...new Set(
      parts
        .flatMap((part) => [
          ...(Array.isArray(part?.machine_ids) ? part.machine_ids : []),
          part?.machine_id
        ])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  ];

  const machineNameById = new Map();
  if (ids.length > 0 && Machine) {
    const machineDocs = await Machine.find({ _id: { $in: ids } }).select({ _id: 1, name: 1 }).lean().catch(() => []);
    machineDocs.forEach((doc) => {
      machineNameById.set(String(doc._id), doc.name || '');
    });
  }

  return parts.map((part) => toSparePartApiShape(part, machineNameById));
};

// Import routes
const storeRoutes = require('./src/routes/storeRoutes');
const transferRoutes = require('./src/routes/transferRoutes');
const purchaseOrdersRoutes = require('./src/routes/purchaseOrdersRoutes');
const storeOrdersRoutes = require('./src/routes/storeOrdersRoutes');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
console.log('Serving frontend mode:', process.env.NODE_ENV);
const isProduction = process.env.NODE_ENV === 'production';
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
const SLOW_ENDPOINT_MS = Number(process.env.SLOW_ENDPOINT_MS || 250);
const METRICS_WINDOW_SIZE = 500;
const METRICS_REQUIRE_AUTH = /^(1|true|yes|on)$/i.test(String(process.env.METRICS_REQUIRE_AUTH || '').trim());
const METRICS_AUTH_TOKEN = String(process.env.METRICS_AUTH_TOKEN || '').trim();

const observability = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  totalSlowRequests: 0,
  recentDurationsMs: [],
  perRoute: new Map()
};

const appendRollingMetric = (arr, value, max = METRICS_WINDOW_SIZE) => {
  arr.push(value);
  if (arr.length > max) {
    arr.shift();
  }
};

const percentile = (values = [], p = 95) => {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[rank].toFixed(2));
};

const requireMetricsAccess = (req, res, next) => {
  if (!METRICS_REQUIRE_AUTH) {
    return next();
  }

  const header = String(req.headers.authorization || '').trim();
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required for metrics endpoint'
    });
  }

  const token = header.slice(7).trim();
  if (!METRICS_AUTH_TOKEN || token !== METRICS_AUTH_TOKEN) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: invalid metrics token'
    });
  }

  return next();
};

// Connect to MongoDB
connectDB();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve frontend static files only in production.
if (isProduction) {
  app.use(express.static(frontendBuildPath));
}

// Request correlation + timing instrumentation.
app.use((req, res, next) => {
  const incomingRequestId = String(req.headers['x-request-id'] || '').trim();
  req.requestId = incomingRequestId || randomUUID();
  res.setHeader('X-Request-ID', req.requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const routePath = req.route?.path || req.path || 'unknown';
    const routeKey = `${req.method} ${routePath}`;
    const statusCode = Number(res.statusCode || 0);
    const isError = statusCode >= 500;
    const isSlow = durationMs >= SLOW_ENDPOINT_MS;

    observability.totalRequests += 1;
    if (isError) observability.totalErrors += 1;
    if (isSlow) observability.totalSlowRequests += 1;
    appendRollingMetric(observability.recentDurationsMs, durationMs);

    const routeStats = observability.perRoute.get(routeKey) || {
      count: 0,
      errors: 0,
      slow: 0,
      durationsMs: []
    };
    routeStats.count += 1;
    if (isError) routeStats.errors += 1;
    if (isSlow) routeStats.slow += 1;
    appendRollingMetric(routeStats.durationsMs, durationMs, 200);
    observability.perRoute.set(routeKey, routeStats);

    const logPayload = {
      ts: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      route: routePath,
      statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      isSlow
    };
    console.log(JSON.stringify(logPayload));
  });

  next();
});

// Health endpoints
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API connection successful!' });
});

app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const modelsStatus = {
    Store: !!models.Store,
    Machine: !!models.Machine,
    SparePart: !!models.SparePart,
    Order: !!models.Order,
    PurchaseOrder: !!models.PurchaseOrder,
    Transfer: !!models.Transfer
  };
  res.json({ 
    success: true, 
    message: 'API healthy',
    dbConnected,
    modelsStatus,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/metrics', requireMetricsAccess, (req, res) => {
  const routeStats = Array.from(observability.perRoute.entries())
    .map(([route, stats]) => ({
      route,
      count: stats.count,
      errorRate: stats.count > 0 ? Number(((stats.errors / stats.count) * 100).toFixed(2)) : 0,
      slowRate: stats.count > 0 ? Number(((stats.slow / stats.count) * 100).toFixed(2)) : 0,
      p95Ms: percentile(stats.durationsMs, 95),
      avgMs: stats.durationsMs.length > 0
        ? Number((stats.durationsMs.reduce((sum, value) => sum + value, 0) / stats.durationsMs.length).toFixed(2))
        : 0
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, 10);

  const totalRequests = observability.totalRequests;
  const errorRate = totalRequests > 0
    ? Number(((observability.totalErrors / totalRequests) * 100).toFixed(2))
    : 0;
  const slowRate = totalRequests > 0
    ? Number(((observability.totalSlowRequests / totalRequests) * 100).toFixed(2))
    : 0;

  res.json({
    success: true,
    data: {
      uptimeSeconds: Math.floor((Date.now() - observability.startedAt) / 1000),
      thresholds: {
        slowEndpointMs: SLOW_ENDPOINT_MS,
        p95TargetMs: 250
      },
      totals: {
        requests: totalRequests,
        errors: observability.totalErrors,
        slowRequests: observability.totalSlowRequests,
        errorRate,
        slowRate,
        p95Ms: percentile(observability.recentDurationsMs, 95)
      },
      topRoutesByP95: routeStats,
      generatedAt: new Date().toISOString()
    }
  });
});

app.get('/api/metrics/prometheus', requireMetricsAccess, (req, res) => {
  const totalRequests = observability.totalRequests;
  const routeStats = Array.from(observability.perRoute.entries());
  const lines = [];

  lines.push('# HELP http_requests_total Total HTTP requests handled by the process.');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${totalRequests}`);

  lines.push('# HELP http_errors_total Total HTTP requests with status >= 500.');
  lines.push('# TYPE http_errors_total counter');
  lines.push(`http_errors_total ${observability.totalErrors}`);

  lines.push('# HELP http_slow_requests_total Total HTTP requests slower than configured threshold.');
  lines.push('# TYPE http_slow_requests_total counter');
  lines.push(`http_slow_requests_total ${observability.totalSlowRequests}`);

  lines.push('# HELP http_request_duration_p95_ms Rolling p95 request latency in milliseconds.');
  lines.push('# TYPE http_request_duration_p95_ms gauge');
  lines.push(`http_request_duration_p95_ms ${percentile(observability.recentDurationsMs, 95)}`);

  lines.push('# HELP http_route_requests_total Requests per route key (method + route path).');
  lines.push('# TYPE http_route_requests_total counter');
  routeStats.forEach(([route, stats]) => {
    lines.push(`http_route_requests_total{route="${route}"} ${stats.count}`);
  });

  lines.push('# HELP http_route_errors_total Errors per route key (status >= 500).');
  lines.push('# TYPE http_route_errors_total counter');
  routeStats.forEach(([route, stats]) => {
    lines.push(`http_route_errors_total{route="${route}"} ${stats.errors}`);
  });

  lines.push('# HELP http_route_p95_ms Rolling p95 latency per route in milliseconds.');
  lines.push('# TYPE http_route_p95_ms gauge');
  routeStats.forEach(([route, stats]) => {
    lines.push(`http_route_p95_ms{route="${route}"} ${percentile(stats.durationsMs, 95)}`);
  });

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(`${lines.join('\n')}\n`);
});

// Routes
app.use('/api/stores', storeRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/purchases', purchaseOrdersRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/orders', storeOrdersRoutes);

// Alerts placeholder
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, data: { alerts: [], summary: { total: 0 } } });
});

// Orders
app.get('/api/orders-list', async (req, res) => {
  try {
    const Order = models.Order;
    if (!Order) return res.json({ success: true, data: { orders: [], summary: { total: 0 } } });
    let filter = { is_deleted: { $ne: true } };
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.search) filter.customerName = { $regex: req.query.search, $options: 'i' };
    const orders = await Order.find(filter).catch(() => []);
    res.json({ success: true, data: { orders, summary: { total: orders.length } } });
  } catch (err) {
    res.json({ success: true, data: { orders: [], summary: { total: 0 } } });
  }
});

app.post('/api/orders-list', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!Order) return res.status(500).json({ success: false, message: 'Order model not initialized' });
    const { customerName, customerEmail, customerPhone, machines, totalAmount, paymentStatus, verifiedBy, orderDate } = req.body;
    if (!customerName) return res.status(400).json({ success: false, message: 'Customer name required' });
    const order = new Order({ customerName, customerEmail, customerPhone, machines, totalAmount, paymentStatus, verifiedBy, orderDate });
    await order.save();
    res.json({ success: true, data: { order }, message: 'Order created' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/orders/:id', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!Order) return res.json({ success: true, message: 'Order deleted', data: null });
    await Order.findByIdAndUpdate(
      req.params.id,
      {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: String(req.user?.id || req.user?.sub || 'unknown')
      },
      { new: true }
    ).catch(() => null);
    console.log('Order soft deleted', {
      at: new Date().toISOString(),
      orderId: req.params.id,
      by: String(req.user?.id || req.user?.sub || 'unknown')
    });
    res.json({ success: true, message: 'Order deleted', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Machines
app.get('/api/machines', async (req, res) => {
  try {
    const Machine = models.Machine;
    if (!Machine) return res.json({ success: true, data: { machines: [] } });
    let filter = {};
    if (req.query.storeId) filter.store_id = req.query.storeId;
    const machines = await Machine.find(filter).catch(() => []);
    const responseMachines = machines.map((machine) => toMachineApiShape(machine.toObject ? machine.toObject() : machine));
    res.json({ success: true, data: { machines: responseMachines } });
  } catch (err) {
    res.json({ success: true, data: { machines: [] } });
  }
});

app.get('/api/stores/:storeId/machines', async (req, res) => {
  try {
    const { storeId } = req.params;
    if (!Machine) return res.json({ success: true, data: { store: { id: storeId }, machines: [], lowStockCount: 0 } });
    const machines = await Machine.find({ store_id: storeId }).catch(() => []);
    const lowStockCount = machines.filter(m => m.quantity_available <= m.minimum_required).length;
    const responseMachines = machines.map((machine) => toMachineApiShape(machine.toObject ? machine.toObject() : machine));
    res.json({ success: true, data: { store: { id: storeId }, machines: responseMachines, lowStockCount } });
  } catch (err) {
    res.json({ success: true, data: { store: { id: req.params.storeId }, machines: [], lowStockCount: 0 } });
  }
});

app.post('/api/machines', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!Machine) return res.status(500).json({ success: false, message: 'Machine model not initialized' });
    const { name, store_id, quantity_available, minimum_required, warranty_expiry_date } = req.body;
    if (!name || !store_id) return res.status(400).json({ success: false, message: 'Name and store_id required' });
    const machine = new Machine({ name, store_id, quantity_available, minimum_required, warranty_expiry_date });
    await machine.save();
    const responseMachine = toMachineApiShape(machine.toObject ? machine.toObject() : machine);
    res.json({ success: true, data: { machine: responseMachine }, message: 'Machine created' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/machines/:id', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!Machine) {
      return res.status(500).json({ success: false, message: 'Machine model not initialized' });
    }

    const machineId = String(req.params.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(machineId)) {
      return res.status(400).json({ success: false, message: 'Invalid machine ID' });
    }

    const deletedMachine = await Machine.findByIdAndDelete(machineId);
    if (!deletedMachine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    return res.json({
      success: true,
      message: 'Machine deleted successfully',
      data: { id: machineId }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Variant-aware spares endpoints
app.get('/api/spares', async (req, res) => {
  try {
    if (!SparePart) return res.json({ success: true, data: { spareParts: [] } });
    const selectedStoreId = String(req.query?.storeId || req.query?.store_id || '').trim();
    const filter = selectedStoreId
      ? { store_id: selectedStoreId, is_deleted: { $ne: true } }
      : { is_deleted: { $ne: true } };
    const spareParts = await SparePart.find(filter).lean().catch(() => []);
    const hydrated = await hydrateSparePartMachineNames(spareParts);
    res.json({ success: true, data: { spareParts: hydrated } });
  } catch (err) {
    res.json({ success: true, data: { spareParts: [] } });
  }
});

// Admin migration endpoint (run once)
app.post('/api/admin/migrate-variants', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  const { migrateVariants } = require('./src/utils/migrateVariants');
  migrateVariants(req, res);
});

app.get('/api/inventory', async (req, res) => {
  try {
    if (!SparePart) return res.json({ success: true, data: { inventory: [] } });

    const selectedStoreId = String(req.query?.storeId || req.query?.store_id || '').trim();
    const filter = selectedStoreId
      ? { store_id: selectedStoreId, is_deleted: { $ne: true } }
      : { is_deleted: { $ne: true } };
    const inventory = await SparePart.find(filter).lean().catch(() => []);
    const hydrated = await hydrateSparePartMachineNames(inventory);

    return res.json({
      success: true,
      data: { inventory: hydrated },
      message: selectedStoreId
        ? `Showing inventory for store ${selectedStoreId}`
        : 'Showing inventory for all stores'
    });
  } catch (err) {
    return res.json({ success: true, data: { inventory: [] } });
  }
});

// Global spares summary
app.get('/api/spares/global', async (req, res) => {
  try {
    if (!SparePart) {
      return res.json({
        success: true,
        data: {
          items: [],
          generatedAt: new Date().toISOString()
        },
        message: 'Global inventory unavailable (degraded mode)'
      });
    }

    const pipeline = [
      {
        $match: {
          is_deleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$normalized_name',
          totalQuantity: { $sum: '$quantity_available' },
          stores: {
            $push: {
              storeId: '$store_id',
              storeName: '$store_name',
              quantity: '$quantity_available'
            }
          }
        }
      },
      {
        $project: {
          itemName: '$_id',
          totalQuantity: 1,
          stores: { $slice: ['$stores', 10] }, // Limit stores per item
          _id: 0
        }
      }
    ];

    const items = await SparePart.aggregate(pipeline).catch(() => []);
    res.json({
      success: true,
      data: {
        items,
        generatedAt: new Date().toISOString()
      },
      message: `Global inventory summary (${items.length} items)`
    });
  } catch (err) {
    res.json({
      success: true,
      data: {
        items: [],
        generatedAt: new Date().toISOString()
      }
    });
  }
});

app.post('/api/spares', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!SparePart) return res.status(500).json({ success: false, message: 'SparePart model not initialized' });
    const normalizedName = String(req.body?.name || '').trim().toLowerCase();
    const normalizedSize = String(req.body?.size || '').trim();
    const normalizedUnit = String(req.body?.unit || 'pcs').trim() || 'pcs';
    const normalizedType = String(req.body?.type || '').trim();
    const minimumRequired = Number(req.body?.minimum_required ?? 0);
    const normalizedWarrantyExpiry = req.body?.warranty_expiry_date || null;
    const storeId = String(req.body?.store_id || '').trim();
    const quantityToAdd = Number(req.body?.quantity_available || 0);
    const selectedMachineIds = parseMachineIdsFromBody(req.body);
    const rawPurchaseCost = req.body?.purchase_cost ?? req.body?.cost ?? req.body?.costPrice ?? req.body?.unitPrice ?? req.body?.price;
    const normalizedPurchaseCost = rawPurchaseCost === null || rawPurchaseCost === undefined || String(rawPurchaseCost).trim() === ''
      ? null
      : Number(rawPurchaseCost);

    if (normalizedPurchaseCost !== null && (Number.isNaN(normalizedPurchaseCost) || normalizedPurchaseCost < 0)) {
      return res.status(400).json({ success: false, message: 'purchase_cost must be a non-negative number' });
    }

    if (!normalizedName || !storeId || selectedMachineIds.length === 0) {
      return res.status(400).json({ success: false, message: 'name, store_id, and at least one machine are required' });
    }

    const existing = await SparePart.findOne({ normalized_name: normalizedName, store_id: storeId });
    if (existing) {
      const wasDeleted = !!existing.is_deleted;
      if (wasDeleted) {
        existing.is_deleted = false;
        existing.deleted_at = null;
        existing.deleted_by = '';
      }
      existing.quantity_available = Number(existing.quantity_available || 0) + quantityToAdd;
      const mergedMachineIds = [
        ...new Set([
          ...(Array.isArray(existing.machine_ids) ? existing.machine_ids.map((id) => String(id)) : []),
          ...selectedMachineIds
        ])
      ];
      existing.machine_ids = mergedMachineIds;
      existing.machine_id = mergedMachineIds[0] || existing.machine_id;
      existing.size = normalizedSize || existing.size || '';
      existing.unit = normalizedUnit || existing.unit || 'pcs';
      existing.type = normalizedType || existing.type || '';
      if (!Number.isNaN(minimumRequired) && minimumRequired >= 0) {
        existing.minimum_required = minimumRequired;
      }
      if (normalizedWarrantyExpiry) {
        existing.warranty_expiry_date = normalizedWarrantyExpiry;
      }
      if (normalizedPurchaseCost !== null) {
        existing.purchase_cost = normalizedPurchaseCost;
      }
      await existing.save();
      console.log('Spare part merged/revived via create', {
        at: new Date().toISOString(),
        spareId: String(existing._id),
        revived: wasDeleted
      });
      return res.json({ success: true, data: { sparePart: existing }, message: 'Spare part quantity merged' });
    }

    const sparePart = new SparePart({
      ...req.body,
      name: normalizedName,
      size: normalizedSize,
      unit: normalizedUnit,
      type: normalizedType,
      normalized_name: normalizedName,
      store_id: storeId,
      machine_id: selectedMachineIds[0],
      machine_ids: selectedMachineIds,
      minimum_required: !Number.isNaN(minimumRequired) && minimumRequired >= 0 ? minimumRequired : 0,
      warranty_expiry_date: normalizedWarrantyExpiry,
      purchase_cost: normalizedPurchaseCost
    });

    await sparePart.save();
    res.json({ success: true, data: { sparePart }, message: 'Spare part created' });
  } catch (err) {
    if (err?.code === 11000) {
      try {
        const normalizedName = String(req.body?.name || '').trim().toLowerCase();
        const normalizedSize = String(req.body?.size || '').trim();
        const normalizedUnit = String(req.body?.unit || 'pcs').trim() || 'pcs';
        const normalizedType = String(req.body?.type || '').trim();
        const minimumRequired = Number(req.body?.minimum_required ?? 0);
        const normalizedWarrantyExpiry = req.body?.warranty_expiry_date || null;
        const storeId = String(req.body?.store_id || '').trim();
        const quantityToAdd = Number(req.body?.quantity_available || 0);
        const selectedMachineIds = parseMachineIdsFromBody(req.body);
        const rawPurchaseCost = req.body?.purchase_cost ?? req.body?.cost ?? req.body?.costPrice ?? req.body?.unitPrice ?? req.body?.price;
        const normalizedPurchaseCost = rawPurchaseCost === null || rawPurchaseCost === undefined || String(rawPurchaseCost).trim() === ''
          ? null
          : Number(rawPurchaseCost);
        if (normalizedPurchaseCost !== null && (Number.isNaN(normalizedPurchaseCost) || normalizedPurchaseCost < 0)) {
          return res.status(400).json({ success: false, message: 'purchase_cost must be a non-negative number' });
        }
        const existing = await SparePart.findOne({ normalized_name: normalizedName, store_id: storeId });
        if (existing) {
          existing.quantity_available = Number(existing.quantity_available || 0) + quantityToAdd;
          const mergedMachineIds = [
            ...new Set([
              ...(Array.isArray(existing.machine_ids) ? existing.machine_ids.map((id) => String(id || '').trim()) : []),
              ...selectedMachineIds
            ].filter(Boolean))
          ];
          if (mergedMachineIds.length > 0) {
            existing.machine_ids = mergedMachineIds;
            existing.machine_id = mergedMachineIds[0];
          }
          existing.size = normalizedSize || existing.size || '';
          existing.unit = normalizedUnit || existing.unit || 'pcs';
          existing.type = normalizedType || existing.type || '';
          if (!Number.isNaN(minimumRequired) && minimumRequired >= 0) {
            existing.minimum_required = minimumRequired;
          }
          if (normalizedWarrantyExpiry) {
            existing.warranty_expiry_date = normalizedWarrantyExpiry;
          }
          if (normalizedPurchaseCost !== null) {
            existing.purchase_cost = normalizedPurchaseCost;
          }
          await existing.save();
          return res.json({ success: true, data: { sparePart: existing }, message: 'Spare part quantity merged' });
        }
      } catch (mergeErr) {
        return res.status(500).json({ success: false, message: mergeErr.message });
      }
    }

    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/spares/merge-duplicates', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!SparePart) return res.status(500).json({ success: false, message: 'SparePart model not initialized' });

    const { name, store_id, storeId } = req.body || {};
    const scopedStoreId = String(store_id || storeId || '').trim();

    if (name && String(name).trim()) {
      const result = await mergeDuplicateSpareParts({
        SparePart,
        name,
        storeId: scopedStoreId || null
      });

      return res.json({
        success: true,
        data: {
          mergedGroups: result.merged ? 1 : 0,
          mergedRows: result.mergedCount,
          sparePart: result.sparePart || null
        },
        message: result.merged
          ? `Merged ${result.mergedCount} duplicate row(s) for '${result.normalizedName}'`
          : `No duplicates found for '${result.normalizedName}'`
      });
    }

    const pipeline = [
      {
        $group: {
          _id: {
            normalized_name: '$normalized_name',
            store_id: '$store_id'
          },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ];

    if (scopedStoreId) {
      pipeline.unshift({ $match: { store_id: scopedStoreId } });
    }

    const duplicateGroups = await SparePart.aggregate(pipeline);
    let mergedGroups = 0;
    let mergedRows = 0;

    for (const group of duplicateGroups) {
      const result = await mergeDuplicateSpareParts({
        SparePart,
        name: group._id.normalized_name,
        storeId: group._id.store_id
      });
      if (result.merged) {
        mergedGroups += 1;
        mergedRows += result.mergedCount;
      }
    }

    return res.json({
      success: true,
      data: {
        scannedGroups: duplicateGroups.length,
        mergedGroups,
        mergedRows
      },
      message: mergedGroups > 0
        ? `Merged ${mergedRows} duplicate row(s) across ${mergedGroups} item group(s)`
        : 'No duplicate spare-part rows found'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/spares/:id', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!SparePart) {
      return res.status(500).json({ success: false, message: 'SparePart model not initialized' });
    }

    const spare = await SparePart.findOne({ _id: req.params.id, is_deleted: { $ne: true } }).catch(() => null);
    if (!spare) {
      return res.status(404).json({ success: false, message: 'Spare part not found' });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const normalizedName = String(req.body.name || '').trim().toLowerCase();
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: 'name cannot be empty' });
      }
      updates.name = normalizedName;
      updates.normalized_name = normalizedName;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'quantity_available')) {
      const quantity = Number(req.body.quantity_available);
      if (Number.isNaN(quantity) || quantity < 0) {
        return res.status(400).json({ success: false, message: 'quantity_available must be a non-negative number' });
      }
      updates.quantity_available = quantity;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'minimum_required')) {
      const minimumRequired = Number(req.body.minimum_required);
      if (Number.isNaN(minimumRequired) || minimumRequired < 0) {
        return res.status(400).json({ success: false, message: 'minimum_required must be a non-negative number' });
      }
      updates.minimum_required = minimumRequired;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'type')) {
      updates.type = String(req.body.type || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'size')) {
      updates.size = String(req.body.size || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'unit')) {
      updates.unit = String(req.body.unit || 'pcs').trim() || 'pcs';
    }

    const hasPurchaseCostPayload = Object.prototype.hasOwnProperty.call(req.body, 'purchase_cost')
      || Object.prototype.hasOwnProperty.call(req.body, 'cost')
      || Object.prototype.hasOwnProperty.call(req.body, 'costPrice')
      || Object.prototype.hasOwnProperty.call(req.body, 'unitPrice')
      || Object.prototype.hasOwnProperty.call(req.body, 'price');

    if (hasPurchaseCostPayload) {
      const rawPurchaseCost = req.body?.purchase_cost ?? req.body?.cost ?? req.body?.costPrice ?? req.body?.unitPrice ?? req.body?.price;
      if (rawPurchaseCost === null || rawPurchaseCost === undefined || String(rawPurchaseCost).trim() === '') {
        updates.purchase_cost = null;
      } else {
        const normalizedPurchaseCost = Number(rawPurchaseCost);
        if (Number.isNaN(normalizedPurchaseCost) || normalizedPurchaseCost < 0) {
          return res.status(400).json({ success: false, message: 'purchase_cost must be a non-negative number' });
        }
        updates.purchase_cost = normalizedPurchaseCost;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'warranty_expiry_date')) {
      updates.warranty_expiry_date = req.body.warranty_expiry_date || null;
    }

    const hasMachinePayload = Object.prototype.hasOwnProperty.call(req.body, 'machines')
      || Object.prototype.hasOwnProperty.call(req.body, 'machine_ids')
      || Object.prototype.hasOwnProperty.call(req.body, 'machineIds')
      || Object.prototype.hasOwnProperty.call(req.body, 'machine_id');

    if (hasMachinePayload) {
      const nextMachineIds = parseMachineIdsFromBody(req.body);
      if (nextMachineIds.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one machine is required' });
      }
      updates.machine_ids = nextMachineIds;
      updates.machine_id = nextMachineIds[0];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
    }

    Object.assign(spare, updates);
    const updated = await spare.save();
    console.log('Spare part updated', {
      at: new Date().toISOString(),
      spareId: req.params.id,
      by: String(req.user?.id || req.user?.sub || 'unknown')
    });

    return res.json({
      success: true,
      data: { sparePart: updated },
      message: 'Spare part updated'
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate spare part name in this store' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/spares/:id', requireDbConnected, requireDestructiveAuth, async (req, res) => {
  try {
    if (!SparePart) return res.json({ success: true, message: 'Spare part deleted', data: null });
    await SparePart.findByIdAndUpdate(
      req.params.id,
      {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: String(req.user?.id || req.user?.sub || 'unknown')
      },
      { new: true }
    ).catch(() => null);
    console.log('Spare part soft deleted', {
      at: new Date().toISOString(),
      spareId: req.params.id,
      by: String(req.user?.id || req.user?.sub || 'unknown')
    });
    res.json({ success: true, message: 'Spare part deleted', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Transfer History
app.get('/api/transfer-history', async (req, res) => {
  try {
    if (!Transfer) return res.json({ success: true, data: { transfers: [] } });
    let filter = {};
    if (req.query.storeId) {
      filter.$or = [
        { from_store_id: req.query.storeId },
        { to_store_id: req.query.storeId }
      ];
    }
    const transfers = await Transfer.find(filter).sort({ createdAt: -1 }).limit(50).catch(() => []);
    res.json({ success: true, data: { transfers } });
  } catch (err) {
    res.json({ success: true, data: { transfers: [] } });
  }
});

// Fallback to frontend index.html for SPA routing (production only).
if (isProduction) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
        if (err) {
          return res.status(404).json({ success: false, message: 'Endpoint not found' });
        }
      });
    }
    next();
  });
} else {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.status(404).json({
        success: false,
        message: 'Frontend is not served by backend in development. Use Vite dev server.'
      });
    }
    next();
  });
}

// API 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error handler
const errorHandler = require('./src/middlewares/errorHandler');
app.use(errorHandler);

// Start server
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    const actualPort = server.address().port;
    console.log(`✅ Server running on port ${actualPort}`);
    console.log(`Test: http://localhost:${actualPort}/api/test`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} in use - exiting to allow restart`);
      process.exit(1);
    }
  });
}

module.exports = app;
