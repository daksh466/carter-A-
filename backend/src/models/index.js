const fs = require('fs');

const modelsDir = __dirname;
const models = {};

// SparePart is explicitly canonicalized to avoid schema drift across duplicate model files.
try {
  models.SparePart = require('./SparePart');
  console.log('✅ Loaded model: SparePart (canonical src model)');
} catch (e) {
  console.warn('⚠️ Model SparePart load failed:', e.message);
  models.SparePart = null;
}

// Load from src/models first
const srcModelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js') && file !== 'index.js');
for (const file of srcModelFiles) {
  if (file === 'SparePart.js') continue;
  try {
    const modelName = file.slice(0, -3);
    models[modelName] = require('./' + file);
    console.log(`✅ Loaded model: ${modelName}`);
  } catch(e) {
    console.warn(`⚠️ Model ${modelName} load failed:`, e.message);
    models[modelName] = null;
  }
}

// Load from root models/ if not loaded
['Store', 'Machine', 'Order'].forEach(name => {
  if (!models[name]) {
    try {
      models[name] = require('../../models/' + name);
      console.log(`✅ Loaded root model: ${name}`);
    } catch(e) {
      console.warn(`⚠️ Root model ${name} load failed:`, e.message);
      models[name] = null;
    }
  }
});

module.exports = models;

