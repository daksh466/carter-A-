const Inventory = require('../models/Inventory');

async function predictInventory() {
  const items = await Inventory.find();
  return items.map(item => {
    const history = item.consumptionHistory;
    if (!history || history.length === 0) {
      return { itemName: item.itemName, daysLeft: null };
    }
    const totalUsed = history.reduce((sum, h) => sum + h.quantityUsed, 0);
    const days = history.length;
    const avgDaily = totalUsed / (days || 1);
    const daysLeft = avgDaily > 0 ? Math.floor(item.stockQuantity / avgDaily) : null;
    return { itemName: item.itemName, daysLeft };
  });
}

module.exports = { predictInventory };
