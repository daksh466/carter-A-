const Store = require('../../models/Store');

const mapStorePayload = (body = {}) => {
  const state = body.state || body.address || '';
  const storeHead = body.storeHead || body.name || body.ownerName || '';
  const contact = body.contact || body.phone || body.ownerContact || '';

  return {
    state,
    storeHead,
    contact,
    // Legacy aliases for compatibility with older consumers.
    name: storeHead,
    address: state,
    phone: contact,
    email: body.email || body.storeGmail || ''
  };
};

const normalizeStore = (storeDoc) => {
  const store = storeDoc?.toObject ? storeDoc.toObject() : storeDoc;
  return {
    ...store,
    id: String(store._id),
    state: store.state || store.address || '',
    storeHead: store.storeHead || store.name || '',
    contact: store.contact || store.phone || '',
    name: store.name || store.storeHead || '',
    address: store.address || store.state || '',
    phone: store.phone || store.contact || ''
  };
};

exports.addStore = async (req, res) => {
  try {
    if (!Store) {
      return res.status(500).json({ success: false, message: 'Store model not initialized' });
    }
    const payload = mapStorePayload(req.body);
    if (!payload.state || !payload.storeHead || !payload.contact) {
      return res.status(400).json({
        success: false,
        message: 'State, store head, and contact are required.'
      });
    }

    const store = new Store(payload);
    await store.save();

    return res.status(201).json({
      success: true,
      data: normalizeStore(store),
      message: 'Store created successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create store.',
      error: err.message
    });
  }
};

exports.getStores = async (req, res) => {
  try {
    if (!Store) {
      return res.json({ success: true, data: { stores: [] } });
    }
    const stores = await Store.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: stores.map(normalizeStore),
      message: 'Stores fetched successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stores.',
      error: err.message
    });
  }
};

exports.getStoreById = async (req, res) => {
  try {
    if (!Store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    return res.json({
      success: true,
      data: normalizeStore(store)
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch store.',
      error: err.message
    });
  }
};

exports.updateStore = async (req, res) => {
  try {
    if (!Store) {
      return res.status(500).json({ success: false, message: 'Store model not initialized' });
    }
    const payload = mapStorePayload(req.body);
    if (!payload.state || !payload.storeHead || !payload.contact) {
      return res.status(400).json({
        success: false,
        message: 'State, store head, and contact are required.'
      });
    }

    const store = await Store.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    return res.json({
      success: true,
      data: normalizeStore(store),
      message: 'Store updated successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update store.',
      error: err.message
    });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    if (!Store) {
      return res.json({ success: true, message: 'Store deleted', data: null });
    }
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    return res.json({
      success: true,
      data: normalizeStore(store),
      message: 'Store deleted successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete store.',
      error: err.message
    });
  }
};
