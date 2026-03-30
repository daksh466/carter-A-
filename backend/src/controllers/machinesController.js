const Machine = require('../models/Machine');

const toMachineResponse = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  store_id: doc.store_id,
  storeId: doc.store_id,
  quantity_available: doc.quantity_available,
  quantity: doc.quantity_available,
  minimum_required: doc.minimum_required,
  minimumRequired: doc.minimum_required,
  warranty_expiry_date: doc.warranty_expiry_date,
  warrantyExpiryDate: doc.warranty_expiry_date,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

exports.getMachines = async (req, res) => {
  try {
    const { storeId, store_id } = req.query;
    const selectedStore = store_id || storeId;
    const filter = selectedStore ? { store_id: selectedStore } : {};

    const machines = await Machine.find(filter).sort({ createdAt: -1 });
    const result = machines.map(toMachineResponse);

    return res.status(200).json({
      success: true,
      data: { machines: result },
      message: `Successfully retrieved ${result.length} machines`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving machines',
      error: error.message
    });
  }
};

exports.createMachine = async (req, res) => {
  try {
    console.log('Incoming data (machine):', req.body);
    const {
      name,
      store_id,
      quantity_available,
      minimum_required,
      warranty_expiry_date
    } = req.body;

    const errors = [];
    if (!name || name.trim() === '') errors.push('Machine name is required');
    if (!store_id || store_id.trim() === '') errors.push('Store ID is required');
    if (quantity_available === undefined || quantity_available === null) errors.push('Quantity available is required');
    if (minimum_required === undefined || minimum_required === null) errors.push('Minimum required is required');

    if (quantity_available !== undefined && (isNaN(quantity_available) || Number(quantity_available) < 0)) {
      errors.push('Quantity available must be a non-negative number');
    }
    if (minimum_required !== undefined && (isNaN(minimum_required) || Number(minimum_required) < 0)) {
      errors.push('Minimum required must be a non-negative number');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const machine = await Machine.create({
      name: name.trim(),
      store_id: store_id.trim(),
      quantity_available: Number(quantity_available),
      minimum_required: Number(minimum_required),
      warranty_expiry_date: warranty_expiry_date || null
    });

    console.log('Saved to DB (machine):', machine);

    return res.status(201).json({
      success: true,
      data: { machine: toMachineResponse(machine) },
      message: `Machine '${machine.name}' created successfully`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating machine',
      error: error.message
    });
  }
};
