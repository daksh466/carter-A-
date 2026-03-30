const request = require('supertest');
const app = require('../../server');
const Transfer = require('../../src/models/Transfer');
const SparePart = require('../../src/models/SparePart');
const mongoose = require('mongoose');

describe('Transfer Batch Receive - FEFO Lot Persistence', () => {
  let storeA, storeB, machineId;

  beforeAll(async () => {
    // Setup two stores and a machine
    storeA = new mongoose.Types.ObjectId().toString();
    storeB = new mongoose.Types.ObjectId().toString();
    machineId = new mongoose.Types.ObjectId().toString();
    
    // Clean up any existing data
    await SparePart.deleteMany({ store_id: { $in: [storeA, storeB] } });
    await Transfer.deleteMany({ to_store_id: { $in: [storeA, storeB] } });
  });

  afterAll(async () => {
    await SparePart.deleteMany({ store_id: { $in: [storeA, storeB] } });
    await Transfer.deleteMany({ to_store_id: { $in: [storeA, storeB] } });
  });

  describe('Batch Creation on Receive', () => {
    it('should create batches from batch allocations when receiving incoming shipment', async () => {
      // Create source spare part
      const sourcePart = await SparePart.create({
        name: 'Ball Bearing',
        machine_id: machineId,
        store_id: storeA,
        quantity_available: 50,
        minimum_required: 5,
        batches: [
          {
            batch_number: 'BB-2026-001',
            quantity: 30,
            expiry_date: new Date('2028-06-30'),
            received_date: new Date('2026-01-15')
          },
          {
            batch_number: 'BB-2026-002',
            quantity: 20,
            expiry_date: new Date('2027-12-31'),
            received_date: new Date('2026-02-20')
          }
        ]
      });

      // Create incoming transfer with batch allocations
      const transfer = await Transfer.create({
        type: 'incoming',
        from_external_name: 'Supplier ABC',
        to_store_id: storeB,
        to_store_name: 'Store B',
        from_store_name: 'External Supplier',
        dispatch_date: new Date(),
        expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        items: [
          {
            spare_part_id: sourcePart._id.toString(),
            spare_part_name: 'Ball Bearing',
            item_id: sourcePart._id,
            item_name: 'Ball Bearing',
            normalized_name: 'ball bearing',
            machine_id: machineId,
            minimum_required: 5,
            quantity: 50,
            batch_allocations: [
              {
                source_batch_number: 'BB-2026-001',
                destination_batch_number: 'BB-2026-001',
                quantity: 30,
                expiry_date: new Date('2028-06-30')
              },
              {
                source_batch_number: 'BB-2026-002',
                destination_batch_number: 'BB-2026-002',
                quantity: 20,
                expiry_date: new Date('2027-12-31')
              }
            ]
          }
        ],
        total_items: 1,
        status: 'in_transit'
      });

      // Receive the shipment
      const receiveRes = await request(app)
        .patch(`/api/transfers/${transfer._id}/receive`)
        .send({
          receivedDate: new Date().toISOString(),
          receivedBy: 'QA Manager'
        });

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.success).toBe(true);
      expect(receiveRes.body.data.transfer.status).toBe('received');

      // Verify batches were created in destination
      const destPart = await SparePart.findOne({
        store_id: storeB,
        normalized_name: 'ball bearing'
      });

      expect(destPart).not.toBeNull();
      expect(destPart.batches).toBeDefined();
      expect(destPart.batches.length).toBe(2);
      
      // Check batch 1
      const batch1 = destPart.batches.find(b => b.batch_number === 'BB-2026-001');
      expect(batch1).toBeDefined();
      expect(batch1.quantity).toBe(30);
      expect(batch1.expiry_date).toBeDefined();

      // Check batch 2
      const batch2 = destPart.batches.find(b => b.batch_number === 'BB-2026-002');
      expect(batch2).toBeDefined();
      expect(batch2.quantity).toBe(20);
      expect(batch2.expiry_date).toBeDefined();

      // Verify quantity_available is synced from batches
      expect(destPart.quantity_available).toBe(50);
    });
  });

  describe('Batch Merge on Receive', () => {
    it('should merge incoming batch into existing batch with same batch number', async () => {
      // Create destination spare part with existing batch
      const destPart = await SparePart.create({
        name: 'Diesel Filter',
        machine_id: machineId,
        store_id: storeB,
        quantity_available: 15,
        minimum_required: 3,
        batches: [
          {
            batch_number: 'DF-2026-A',
            quantity: 15,
            expiry_date: new Date('2027-06-30'),
            received_date: new Date('2026-01-10')
          }
        ]
      });

      // Create source spare part with matching batch
      const sourcePart = await SparePart.create({
        name: 'Diesel Filter',
        machine_id: machineId,
        store_id: storeA,
        quantity_available: 10,
        minimum_required: 3,
        batches: [
          {
            batch_number: 'DF-2026-A',
            quantity: 10,
            expiry_date: new Date('2027-06-30'),
            received_date: new Date('2026-01-15')
          }
        ]
      });

      // Create incoming transfer to merge batch
      const transfer = await Transfer.create({
        type: 'incoming',
        from_external_name: 'Supplier XYZ',
        to_store_id: storeB,
        to_store_name: 'Store B',
        from_store_name: 'External Supplier',
        dispatch_date: new Date(),
        expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        items: [
          {
            spare_part_id: sourcePart._id.toString(),
            spare_part_name: 'Diesel Filter',
            item_id: sourcePart._id,
            item_name: 'Diesel Filter',
            normalized_name: 'diesel filter',
            machine_id: machineId,
            minimum_required: 3,
            quantity: 10,
            batch_allocations: [
              {
                source_batch_number: 'DF-2026-A',
                destination_batch_number: 'DF-2026-A',
                quantity: 10,
                expiry_date: new Date('2027-06-30')
              }
            ]
          }
        ],
        total_items: 1,
        status: 'in_transit'
      });

      // Receive the shipment
      const receiveRes = await request(app)
        .patch(`/api/transfers/${transfer._id}/receive`)
        .send({
          receivedDate: new Date().toISOString(),
          receivedBy: 'Warehouse Officer'
        });

      expect(receiveRes.status).toBe(200);

      // Verify batches were merged
      const updatedPart = await SparePart.findOne({
        store_id: storeB,
        normalized_name: 'diesel filter'
      });

      expect(updatedPart).not.toBeNull();
      expect(updatedPart.batches.length).toBe(1);
      
      const mergedBatch = updatedPart.batches[0];
      expect(mergedBatch.batch_number).toBe('DF-2026-A');
      expect(mergedBatch.quantity).toBe(25); // 15 + 10
      
      // Verify quantity_available is synced
      expect(updatedPart.quantity_available).toBe(25);
    });
  });

  describe('Multiple Batch Allocations', () => {
    it('should handle multiple different batches in single transfer', async () => {
      // Create source with multiple batches
      const sourcePart = await SparePart.create({
        name: 'Hydraulic Hose',
        machine_id: machineId,
        store_id: storeA,
        quantity_available: 60,
        minimum_required: 5,
        batches: [
          {
            batch_number: 'HH-Q1-2026',
            quantity: 20,
            expiry_date: new Date('2028-02-28'),
            received_date: new Date('2026-01-05')
          },
          {
            batch_number: 'HH-Q2-2026',
            quantity: 25,
            expiry_date: new Date('2027-06-30'),
            received_date: new Date('2026-03-10')
          },
          {
            batch_number: 'HH-Q3-2026',
            quantity: 15,
            expiry_date: new Date('2027-02-28'),
            received_date: new Date('2026-02-15')
          }
        ]
      });

      // Create transfer with all three batches
      const transfer = await Transfer.create({
        type: 'incoming',
        from_external_name: 'Hydraulics Plus',
        to_store_id: storeB,
        to_store_name: 'Store B',
        from_store_name: 'External Supplier',
        dispatch_date: new Date(),
        expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        items: [
          {
            spare_part_id: sourcePart._id.toString(),
            spare_part_name: 'Hydraulic Hose',
            item_id: sourcePart._id,
            item_name: 'Hydraulic Hose',
            normalized_name: 'hydraulic hose',
            machine_id: machineId,
            minimum_required: 5,
            quantity: 60,
            batch_allocations: [
              {
                source_batch_number: 'HH-Q1-2026',
                destination_batch_number: 'HH-Q1-2026',
                quantity: 20,
                expiry_date: new Date('2028-02-28')
              },
              {
                source_batch_number: 'HH-Q2-2026',
                destination_batch_number: 'HH-Q2-2026',
                quantity: 25,
                expiry_date: new Date('2027-06-30')
              },
              {
                source_batch_number: 'HH-Q3-2026',
                destination_batch_number: 'HH-Q3-2026',
                quantity: 15,
                expiry_date: new Date('2027-02-28')
              }
            ]
          }
        ],
        total_items: 1,
        status: 'in_transit'
      });

      // Receive the shipment
      const receiveRes = await request(app)
        .patch(`/api/transfers/${transfer._id}/receive`)
        .send({
          receivedDate: new Date().toISOString(),
          receivedBy: 'Logistics Manager'
        });

      expect(receiveRes.status).toBe(200);

      // Verify all batches were created
      const destPart = await SparePart.findOne({
        store_id: storeB,
        normalized_name: 'hydraulic hose'
      });

      expect(destPart).not.toBeNull();
      expect(destPart.batches.length).toBe(3);
      
      // Verify each batch
      const batchMap = new Map(destPart.batches.map(b => [b.batch_number, b]));
      
      expect(batchMap.get('HH-Q1-2026')?.quantity).toBe(20);
      expect(batchMap.get('HH-Q2-2026')?.quantity).toBe(25);
      expect(batchMap.get('HH-Q3-2026')?.quantity).toBe(15);
      
      // Verify total quantity
      expect(destPart.quantity_available).toBe(60);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle transfers without batch allocations (simple quantity increment)', async () => {
      // Create source spare part without batches
      const sourcePart = await SparePart.create({
        name: 'O-Ring',
        machine_id: machineId,
        store_id: storeA,
        quantity_available: 100,
        minimum_required: 10,
        batches: []
      });

      // Create transfer without batch allocations
      const transfer = await Transfer.create({
        type: 'incoming',
        from_external_name: 'Generic Supplier',
        to_store_id: storeB,
        to_store_name: 'Store B',
        from_store_name: 'External Supplier',
        dispatch_date: new Date(),
        expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        items: [
          {
            spare_part_id: sourcePart._id.toString(),
            spare_part_name: 'O-Ring',
            item_id: sourcePart._id,
            item_name: 'O-Ring',
            normalized_name: 'o-ring',
            machine_id: machineId,
            minimum_required: 10,
            quantity: 100,
            batch_allocations: [] // No batches
          }
        ],
        total_items: 1,
        status: 'in_transit'
      });

      // Receive the shipment
      const receiveRes = await request(app)
        .patch(`/api/transfers/${transfer._id}/receive`)
        .send({
          receivedDate: new Date().toISOString(),
          receivedBy: 'Receiver'
        });

      expect(receiveRes.status).toBe(200);

      // Verify quantity was added without batches
      const destPart = await SparePart.findOne({
        store_id: storeB,
        normalized_name: 'o-ring'
      });

      expect(destPart).not.toBeNull();
      expect(destPart.quantity_available).toBe(100);
      // Batches should be empty or not interfere
      expect(Array.isArray(destPart.batches) ? destPart.batches.length : 0).toBe(0);
    });
  });

  describe('Quantity Sync from Batches', () => {
    it('should always sync quantity_available from sum of batch quantities', async () => {
      // Create destination with some batches
      const destPart = await SparePart.create({
        name: 'Spark Plug',
        machine_id: machineId,
        store_id: storeB,
        quantity_available: 45,
        minimum_required: 2,
        batches: [
          {
            batch_number: 'SP-2026-01',
            quantity: 25,
            expiry_date: new Date('2027-12-31'),
            received_date: new Date('2026-01-01')
          },
          {
            batch_number: 'SP-2026-02',
            quantity: 20,
            expiry_date: new Date('2028-06-30'),
            received_date: new Date('2026-02-01')
          }
        ]
      });

      // Create source part
      const sourcePart = await SparePart.create({
        name: 'Spark Plug',
        machine_id: machineId,
        store_id: storeA,
        quantity_available: 35,
        minimum_required: 2,
        batches: [
          {
            batch_number: 'SP-2026-03',
            quantity: 35,
            expiry_date: new Date('2028-03-31'),
            received_date: new Date('2026-01-15')
          }
        ]
      });

      // Create transfer to add new batch
      const transfer = await Transfer.create({
        type: 'incoming',
        from_external_name: 'Auto Parts Co',
        to_store_id: storeB,
        to_store_name: 'Store B',
        from_store_name: 'External Supplier',
        dispatch_date: new Date(),
        expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        items: [
          {
            spare_part_id: sourcePart._id.toString(),
            spare_part_name: 'Spark Plug',
            item_id: sourcePart._id,
            item_name: 'Spark Plug',
            normalized_name: 'spark plug',
            machine_id: machineId,
            minimum_required: 2,
            quantity: 35,
            batch_allocations: [
              {
                source_batch_number: 'SP-2026-03',
                destination_batch_number: 'SP-2026-03',
                quantity: 35,
                expiry_date: new Date('2028-03-31')
              }
            ]
          }
        ],
        total_items: 1,
        status: 'in_transit'
      });

      // Receive the shipment
      const receiveRes = await request(app)
        .patch(`/api/transfers/${transfer._id}/receive`)
        .send({
          receivedDate: new Date().toISOString(),
          receivedBy: 'Inventory Clerk'
        });

      expect(receiveRes.status).toBe(200);

      // Verify quantity_available = sum of all batch quantities
      const updatedPart = await SparePart.findOne({
        store_id: storeB,
        normalized_name: 'spark plug'
      });

      expect(updatedPart.batches.length).toBe(3);
      const batchSum = updatedPart.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      expect(updatedPart.quantity_available).toBe(batchSum);
      expect(updatedPart.quantity_available).toBe(80); // 25 + 20 + 35
    });
  });
});
