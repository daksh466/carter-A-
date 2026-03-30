const mongoose = require('mongoose');

const srcSparePart = require('../../src/models/SparePart');
const rootSparePart = require('../../models/SparePart');
const modelsIndex = require('../../src/models');

describe('SparePart model unification', () => {
  test('root SparePart exports canonical src model', () => {
    expect(rootSparePart).toBe(srcSparePart);
  });

  test('models index exposes canonical SparePart model', () => {
    expect(modelsIndex.SparePart).toBe(srcSparePart);
  });

  test('mongoose registers only one SparePart model', () => {
    const names = mongoose.modelNames().filter((name) => name === 'SparePart');
    expect(names.length).toBe(1);
  });
});
