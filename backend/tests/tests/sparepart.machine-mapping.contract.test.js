const SparePart = require('../../src/models/SparePart');
const { mergeMachineIds } = require('../../src/utils/sparePartDedup');

describe('SparePart machine mapping contract', () => {
  test('machine_ids are deduplicated and machine_id tracks first canonical id', async () => {
    const doc = new SparePart({
      name: 'Contract Part',
      store_id: 'STORE-1',
      machine_id: 'M-1',
      machine_ids: ['M-1', 'M-2', 'M-1', '  M-2  ', ''],
      quantity_available: 10,
      minimum_required: 2,
    });

    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.machine_ids).toEqual(['M-1', 'M-2']);
    expect(doc.machine_id).toBe('M-1');
    expect(doc.normalized_name).toBe('contract part');
  });

  test('legacy machine_id-only payload is promoted to machine_ids without data loss', async () => {
    const doc = new SparePart({
      name: 'Legacy Part',
      store_id: 'STORE-2',
      machine_id: 'LEGACY-M-1',
      quantity_available: 4,
      minimum_required: 1,
    });

    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.machine_ids).toEqual(['LEGACY-M-1']);
    expect(doc.machine_id).toBe('LEGACY-M-1');
    expect(doc.normalized_name).toBe('legacy part');
  });

  test('mergeMachineIds keeps all unique machine mappings in deterministic order', () => {
    const merged = mergeMachineIds(['A', 'B', 'A'], ['B', 'C', '  C  ', '', null]);
    expect(merged).toEqual(['A', 'B', 'C']);
  });
});
