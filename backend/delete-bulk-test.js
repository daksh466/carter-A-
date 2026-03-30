// MongoDB shell script to delete all BULK_TEST data
// Run: mongo mongodb://localhost:27017/yourdb_name delete-bulk-test.js

use your_database_name; // CHANGE THIS TO YOUR DB NAME

print("🗑️ Deleting BULK_TEST data...");

// db.stores.deleteMany({name: /^BULK_TEST_2024/});
print("Stores deleted");

db.machines.deleteMany({name: /^BULK_TEST_2024/});
print("Machines deleted");

db.spareparts.deleteMany({name: /^BULK_TEST_2024/});
print("SpareParts deleted");

db.transfers.deleteMany({notes: "BULK_TEST_2024"});
print("Transfers deleted");

db.purchaseorders.deleteMany({notes: "BULK_TEST_2024"});
print("PurchaseOrders deleted");

db.orders.deleteMany({notes: "BULK_TEST_2024"});
print("Orders deleted");

print("✅ All BULK_TEST data deleted!");

