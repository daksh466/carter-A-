// --- Inventory Intelligence ---
const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  stockQuantity: { type: Number, required: true, min: 0 },
  threshold: { type: Number, default: 5, min: 0 },
  isLowStock: { type: Boolean, default: false },
  consumptionHistory: [
    {
      date: { type: Date, required: true },
      quantityUsed: { type: Number, required: true, min: 0 }
    }
  ]
});
const Inventory = mongoose.model("Inventory", inventorySchema);

// Helper: update isLowStock
async function updateLowStock(item) {
  item.isLowStock = item.stockQuantity < (item.threshold || 5);
  await item.save();
}

// Add/Update Inventory Item
app.post("/inventory", async (req, res) => {
  try {
    const { itemName, stockQuantity, threshold } = req.body;
    if (!itemName || stockQuantity === undefined) {
      return res.status(400).json({ success: false, message: "Missing itemName or stockQuantity" });
    }
    let item = await Inventory.findOne({ itemName });
    if (item) {
      item.stockQuantity = stockQuantity;
      if (threshold !== undefined) item.threshold = threshold;
      await updateLowStock(item);
      return res.status(200).json({ success: true, data: item });
    } else {
      item = new Inventory({ itemName, stockQuantity, threshold });
      await updateLowStock(item);
      return res.status(201).json({ success: true, data: item });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add/update inventory", error: error.message });
  }
});

// Track consumption
app.post("/inventory/:id/consume", async (req, res) => {
  try {
    const { quantityUsed } = req.body;
    if (quantityUsed === undefined || quantityUsed < 0) {
      return res.status(400).json({ success: false, message: "Invalid quantityUsed" });
    }
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    item.stockQuantity -= quantityUsed;
    item.consumptionHistory.push({ date: new Date(), quantityUsed });
    await updateLowStock(item);
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to track consumption", error: error.message });
  }
});

// Prediction API
app.get("/inventory/prediction", async (req, res) => {
  try {
    const items = await Inventory.find();
    const predictions = items.map(item => {
      const history = item.consumptionHistory;
      if (!history || history.length === 0) {
        return { itemName: item.itemName, daysLeft: null };
      }
      // Average daily usage
      const totalUsed = history.reduce((sum, h) => sum + h.quantityUsed, 0);
      const days = (history.length > 0) ? history.length : 1;
      const avgDaily = totalUsed / days;
      const daysLeft = avgDaily > 0 ? Math.floor(item.stockQuantity / avgDaily) : null;
      return { itemName: item.itemName, daysLeft };
    });
    return res.status(200).json({ success: true, predictions });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to predict inventory", error: error.message });
  }
});

// Alert API
app.get("/inventory/alerts", async (req, res) => {
  try {
    const items = await Inventory.find();
    const alerts = [];
    const now = new Date();
    for (const item of items) {
      const history = item.consumptionHistory;
      if (!history || history.length === 0) continue;
      const totalUsed = history.reduce((sum, h) => sum + h.quantityUsed, 0);
      const days = history.length;
      const avgDaily = totalUsed / (days || 1);
      const daysLeft = avgDaily > 0 ? item.stockQuantity / avgDaily : null;
      if (daysLeft !== null && daysLeft <= 7) {
        alerts.push({ itemName: item.itemName, stockQuantity: item.stockQuantity, daysLeft: Math.floor(daysLeft) });
      }
    }
    return res.status(200).json({ success: true, alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get inventory alerts", error: error.message });
  }
});
// --- PUT & DELETE APIs for All Models ---
// Machine
app.put("/machine/:id", async (req, res) => {
  try {
    const { machineName, machineId, warrantyStatus, purchaseDate } = req.body;
    const allowedWarranty = ["active", "expired"];
    if (warrantyStatus && !allowedWarranty.includes(warrantyStatus)) {
      return res.status(400).json({ success: false, message: `Invalid warrantyStatus. Allowed values are ${allowedWarranty.join(", ")}` });
    }
    const machine = await Machine.findByIdAndUpdate(
      req.params.id,
      { machineName, machineId, warrantyStatus, purchaseDate },
      { new: true, runValidators: true }
    );
    if (!machine) return res.status(404).json({ success: false, message: "Machine not found" });
    return res.status(200).json({ success: true, data: machine });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update machine", error: error.message });
  }
});
app.delete("/machine/:id", async (req, res) => {
  try {
    const machine = await Machine.findByIdAndDelete(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: "Machine not found" });
    return res.status(200).json({ success: true, data: machine });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete machine", error: error.message });
  }
});

// Payment
app.put("/payment/:id", async (req, res) => {
  try {
    const { amount, paymentDate, paymentBy, supervisedBy } = req.body;
    const allowedPaymentBy = ["cash", "online", "dealer"];
    if (paymentBy && !allowedPaymentBy.includes(paymentBy)) {
      return res.status(400).json({ success: false, message: `Invalid paymentBy. Allowed values are ${allowedPaymentBy.join(", ")}` });
    }
    if (amount !== undefined && amount < 0) {
      return res.status(400).json({ success: false, message: "Amount cannot be negative" });
    }
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { amount, paymentDate, paymentBy, supervisedBy },
      { new: true, runValidators: true }
    );
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update payment", error: error.message });
  }
});
app.delete("/payment/:id", async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete payment", error: error.message });
  }
});

// SparePart
app.put("/spare/:id", async (req, res) => {
  try {
    const { partName, type } = req.body;
    const allowedSpareType = ["ordered", "required"];
    if (type && !allowedSpareType.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Allowed values are ${allowedSpareType.join(", ")}` });
    }
    const spare = await SparePart.findByIdAndUpdate(
      req.params.id,
      { partName, type },
      { new: true, runValidators: true }
    );
    if (!spare) return res.status(404).json({ success: false, message: "Spare part not found" });
    return res.status(200).json({ success: true, data: spare });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update spare part", error: error.message });
  }
});
app.delete("/spare/:id", async (req, res) => {
  try {
    const spare = await SparePart.findByIdAndDelete(req.params.id);
    if (!spare) return res.status(404).json({ success: false, message: "Spare part not found" });
    return res.status(200).json({ success: true, data: spare });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete spare part", error: error.message });
  }
});

// Service
app.put("/service/:id", async (req, res) => {
  try {
    const { machineId, workDetails, engineerName, date } = req.body;
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { machineId, workDetails, engineerName, date },
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ success: false, message: "Service not found" });
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update service", error: error.message });
  }
});
app.delete("/service/:id", async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found" });
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete service", error: error.message });
  }
});

// --- Bulk Operations ---
app.post("/connections/bulk", async (req, res) => {
  try {
    const connections = req.body.connections;
    if (!Array.isArray(connections) || connections.length === 0) {
      return res.status(400).json({ success: false, message: "connections must be a non-empty array" });
    }
    // Validate enums for each
    const allowedCategories = ["customer", "supplier", "neighbour"];
    for (const conn of connections) {
      if (!allowedCategories.includes(conn.category)) {
        return res.status(400).json({ success: false, message: `Invalid category in bulk. Allowed values are ${allowedCategories.join(", ")}` });
      }
    }
    const result = await Connection.insertMany(connections);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Bulk insert failed", error: error.message });
  }
});

app.delete("/connections/bulk", async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids must be a non-empty array" });
    }
    const result = await Connection.deleteMany({ _id: { $in: ids } });
    return res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Bulk delete failed", error: error.message });
  }
});
// --- User Model & Auth ---
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, trim: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "engineer", "customer"], required: true },
});
const User = mongoose.model("User", userSchema);

// Basic Auth Middleware (optional, for demo)
function authMiddleware(req, res, next) {
  // Simple: expects ?user=<userId> in query
  const userId = req.query.user;
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
  User.findById(userId).then(user => {
    if (!user) return res.status(401).json({ success: false, message: "Invalid user" });
    req.user = user;
    next();
  }).catch(() => res.status(401).json({ success: false, message: "Unauthorized" }));
}

app.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, message: "Missing phone or password" });
    const user = await User.findOne({ phone });
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    return res.status(200).json({ success: true, user: { _id: user._id, phone: user.phone, role: user.role } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed", error: error.message });
  }
});
// --- Customer Detail Related Models ---
const machineSchema = new mongoose.Schema({
  machineName: { type: String, required: true, trim: true },
  machineId: { type: String, required: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Connection", required: true },
  warrantyStatus: { type: String, enum: ["active", "expired"], required: true },
  purchaseDate: { type: Date },
});
const Machine = mongoose.model("Machine", machineSchema);

const paymentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Connection", required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  paymentBy: { type: String, enum: ["cash", "online", "dealer"], required: true },
  supervisedBy: { type: String, trim: true },
});
const Payment = mongoose.model("Payment", paymentSchema);

const sparePartSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Connection", required: true },
  partName: { type: String, required: true, trim: true },
  type: { type: String, enum: ["ordered", "required"], required: true },
});
const SparePart = mongoose.model("SparePart", sparePartSchema);

const serviceSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Connection", required: true },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true },
  workDetails: { type: String, trim: true },
  engineerName: { type: String, trim: true },
  date: { type: Date, required: true },
});
const Service = mongoose.model("Service", serviceSchema);

// --- Customer Detail APIs ---
app.post("/machine", async (req, res) => {
  try {
    const { machineName, machineId, customerId, warrantyStatus, purchaseDate } = req.body;
    if (!machineName || !machineId || !customerId || !warrantyStatus) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const machine = await Machine.create({ machineName, machineId, customerId, warrantyStatus, purchaseDate });
    return res.status(201).json({ success: true, data: machine });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add machine", error: error.message });
  }
});

app.post("/payment", async (req, res) => {
  try {
    const { customerId, amount, paymentDate, paymentBy, supervisedBy } = req.body;
    if (!customerId || amount === undefined || !paymentDate || !paymentBy) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (amount < 0) {
      return res.status(400).json({ success: false, message: "Amount cannot be negative" });
    }
    const payment = await Payment.create({ customerId, amount, paymentDate, paymentBy, supervisedBy });
    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add payment", error: error.message });
  }
});

app.post("/spare", async (req, res) => {
  try {
    const { customerId, partName, type } = req.body;
    if (!customerId || !partName || !type) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const spare = await SparePart.create({ customerId, partName, type });
    return res.status(201).json({ success: true, data: spare });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add spare part", error: error.message });
  }
});

app.post("/service", async (req, res) => {
  try {
    const { customerId, machineId, workDetails, engineerName, date } = req.body;
    if (!customerId || !machineId || !date) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const service = await Service.create({ customerId, machineId, workDetails, engineerName, date });
    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add service", error: error.message });
  }
});

app.get("/customer/:id/details", async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await Connection.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Machines
    const machines = await Machine.find({ customerId });
    // Payments
    const payments = await Payment.find({ customerId });
    // Spare Parts
    const spareOrdered = await SparePart.find({ customerId, type: "ordered" });
    const spareRequired = await SparePart.find({ customerId, type: "required" });
    // Service History
    const serviceHistory = await Service.find({ customerId }).populate("machineId", "machineName machineId");

    // Computed fields
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = customer.amountPending || 0;

    return res.status(200).json({
      success: true,
      customer: {
        _id: customer._id,
        businessName: customer.businessName,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        state: customer.state,
        category: customer.category,
        connectedDate: customer.connectedDate,
        amountPending: customer.amountPending,
        amountPaid: customer.amountPaid,
        totalPaid,
        totalPending,
      },
      machines,
      payments,
      spareParts: {
        ordered: spareOrdered,
        required: spareRequired,
      },
      serviceHistory,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch customer details", error: error.message });
  }
});
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = 5000;
const MONGO_URL = "mongodb://127.0.0.1:27017/carter";

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const connectionSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ["customer", "supplier", "neighbour"],
    required: true,
  },
  state: {
    type: String,
    trim: true,
  },
  companyCode: {
    type: String,
    trim: true,
  },
  feedback: {
    type: Number,
    min: 1,
    max: 5,
  },
  commodity: {
    type: String,
    trim: true,
  },
  machineModel: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Advanced tracking fields
  connectedDate: {
    type: Date,
    default: Date.now,
  },
  lastTalkDate: {
    type: Date,
  },
  lastTalkWith: {
    type: String,
    trim: true,
  },
  lastTalkSummary: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  nextActionDate: {
    type: Date,
  },
  amountPending: {
    type: Number,
    default: 0,
    min: 0,
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const Connection = mongoose.model("Connection", connectionSchema);

function validateRequiredFields(body, isUpdate = false) {
  const requiredFields = ["businessName", "phone", "category"];
  const missingFields = [];

  for (const field of requiredFields) {
    const value = body[field];
    const isMissing =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (!isUpdate && isMissing) {
      missingFields.push(field);
    }

    if (isUpdate && Object.prototype.hasOwnProperty.call(body, field) && isMissing) {
      missingFields.push(field);
    }
  }

  return missingFields;
}

function validateTrackingFields(body) {
  const errors = [];
  if (body.amountPending !== undefined && body.amountPending < 0) {
    errors.push("amountPending cannot be negative");
  }
  if (body.amountPaid !== undefined && body.amountPaid < 0) {
    errors.push("amountPaid cannot be negative");
  }
  if (body.lastTalkSummary && body.lastTalkSummary.length > 500) {
    errors.push("lastTalkSummary exceeds 500 characters");
  }
  return errors;
}

function getErrorStatus(error) {
  if (error.name === "ValidationError" || error.name === "CastError") {
    return 400;
  }
  return 500;
}

app.post("/connection", async (req, res) => {
  try {
    const missingFields = validateRequiredFields(req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }
    // Enum validation
    const allowedCategories = ["customer", "supplier", "neighbour"];
    if (req.body.category && !allowedCategories.includes(req.body.category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Allowed values are ${allowedCategories.join(", ")}` });
    }
    // Validation for tracking fields
    const trackingErrors = validateTrackingFields(req.body);
    if (trackingErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: trackingErrors.join(", "),
      });
    }
    // Set connectedDate if not provided
    if (!req.body.connectedDate) {
      req.body.connectedDate = new Date();
    }
    const connection = await Connection.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Connection created successfully",
      data: connection,
    });
  } catch (error) {
    const statusCode = getErrorStatus(error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? "Validation failed" : "Failed to create connection",
      error: error.message,
    });
  }
});

app.get("/connections", async (req, res) => {
  try {
    const { category, state, search, sort, page = "1", limit = "10", nextActionDate, amountPending } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }
    if (state) {
      filter.state = state;
    }
    if (search) {
      filter.$or = [
        { businessName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (nextActionDate) {
      // Filter for nextActionDate >= provided date
      filter.nextActionDate = { $gte: new Date(nextActionDate) };
    }
    if (amountPending === "pending") {
      filter.amountPending = { $gt: 0 };
    }

    const pageNumber = Number.parseInt(page, 10);
    const limitNumber = Number.parseInt(limit, 10);
    if (
      Number.isNaN(pageNumber) ||
      Number.isNaN(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values. 'page' and 'limit' must be positive integers.",
      });
    }

    let sortOption = { createdAt: -1 };
    if (sort === "nextActionDate") {
      sortOption = { nextActionDate: 1 };
    } else if (sort === "amountPending") {
      sortOption = { amountPending: -1 };
    } else if (sort === "name") {
      sortOption = { businessName: 1 };
    } else if (sort && sort !== "latest") {
      return res.status(400).json({
        success: false,
        message: "Invalid sort value. Use 'latest', 'name', 'nextActionDate', or 'amountPending'.",
      });
    }

    const skip = (pageNumber - 1) * limitNumber;
    const total = await Connection.countDocuments(filter);
    const connections = await Connection.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);
    const totalPages = Math.ceil(total / limitNumber);
    return res.status(200).json({
      success: true,
      count: connections.length,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages,
      },
      data: connections,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching connections",
      error: error.message,
    });
  }
});

app.put("/connection/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const missingFields = validateRequiredFields(req.body, true);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Required field(s) cannot be empty: ${missingFields.join(", ")}`,
      });
    }

    // Validation for tracking fields
    const trackingErrors = validateTrackingFields(req.body);
    if (trackingErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: trackingErrors.join(", "),
      });
    }

    const updatedConnection = await Connection.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedConnection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connection updated successfully",
      data: updatedConnection,
    });
  } catch (error) {
    const statusCode = getErrorStatus(error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? "Validation failed" : "Failed to update connection",
      error: error.message,
    });
  }
});

app.delete("/connection/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedConnection = await Connection.findByIdAndDelete(id);

    if (!deletedConnection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connection deleted successfully",
      data: deletedConnection,
    });
  } catch (error) {
    const statusCode = getErrorStatus(error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? "Invalid connection id" : "Failed to delete connection",
      error: error.message,
    });
  }
});

async function startServer() {
  // New API: GET /connections/followups
  app.get("/connections/followups", async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filter = { nextActionDate: { $gte: today } };
      const connections = await Connection.find(filter).sort({ nextActionDate: 1 });
      return res.status(200).json({
        success: true,
        count: connections.length,
        data: connections,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching followups",
        error: error.message,
      });
    }
  });
  try {
    await mongoose.connect(MONGO_URL);
    app.listen(PORT, () => {
      console.log("Server running on port 5000");
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();

/*
// --- Inventory API Sample Usage ---

// POST /inventory
// { "itemName": "Oil Filter", "stockQuantity": 10 }
// Response: { "success": true, "data": { ... } }

// POST /inventory/:id/consume
// { "quantityUsed": 2 }
// Response: { "success": true, "data": { ... } }

// GET /inventory/prediction
// Response: { "success": true, "predictions": [ { "itemName": "Oil Filter", "daysLeft": 4 } ] }

// GET /inventory/alerts
// Response: { "success": true, "alerts": [ { "itemName": "Oil Filter", "stockQuantity": 3, "daysLeft": 2 } ] }

// --- End Inventory API Sample Usage ---
Sample API tests (PowerShell):

// --- Sample API Usage ---

// POST /connection
// Body:
// {
//   "businessName": "Acme Pvt Ltd",
//   "phone": "9876543210",
//   "category": "customer",
//   "state": "CA",
//   "connectedDate": "2026-03-20T10:00:00Z",
//   "lastTalkDate": "2026-03-19T15:00:00Z",
//   "lastTalkWith": "John Doe",
//   "lastTalkSummary": "Discussed payment terms.",
//   "nextActionDate": "2026-03-25T09:00:00Z",
//   "amountPending": 5000,
//   "amountPaid": 2000
// }

// GET /connections?nextActionDate=2026-03-21
// Returns connections with nextActionDate >= 2026-03-21

// GET /connections?amountPending=pending
// Returns connections with amountPending > 0

// GET /connections?sort=nextActionDate
// Sorts by soonest follow-up

// GET /connections?sort=amountPending
// Sorts by highest pending amount

// GET /connections/followups
// Returns connections with nextActionDate today or in future, sorted by nearest date

// PUT /connection/:id
// Body:
// {
//   "lastTalkSummary": "Updated summary.",
//   "amountPaid": 3000
// }

// --- End Sample API Usage ---

// --- Sample Requests & Responses ---

// POST /login
// { "phone": "9876543210", "password": "secret" }
// Response: { "success": true, "user": { "_id": "...", "phone": "9876543210", "role": "admin" } }

// POST /connections/bulk
// { "connections": [ { "businessName": "Acme", "phone": "123", "category": "customer" }, ... ] }
// Response: { "success": true, "data": [ ... ] }

// DELETE /connections/bulk
// { "ids": [ "id1", "id2" ] }
// Response: { "success": true, "deletedCount": 2 }

// PUT /machine/:id
// { "machineName": "Excavator Y", "warrantyStatus": "expired" }
// Response: { "success": true, "data": { ... } }

// DELETE /machine/:id
// Response: { "success": true, "data": { ... } }

// PUT /payment/:id
// { "amount": 1000, "paymentBy": "online" }
// Response: { "success": true, "data": { ... } }

// DELETE /payment/:id
// Response: { "success": true, "data": { ... } }

// PUT /spare/:id
// { "partName": "Filter", "type": "required" }
// Response: { "success": true, "data": { ... } }

// DELETE /spare/:id
// Response: { "success": true, "data": { ... } }

// PUT /service/:id
// { "workDetails": "Replaced filter" }
// Response: { "success": true, "data": { ... } }

// DELETE /service/:id
// Response: { "success": true, "data": { ... } }

// --- End Sample Requests & Responses ---
*/
