const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const run = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/carterAplusplus';
  const backupDir = path.join(__dirname, '../../backups');
  const marker = `smoke-${Date.now()}`;
  const backupFile = path.join(backupDir, `restore-smoke-${Date.now()}.json`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const collection = db.collection('backup_restore_smoke');

  try {
    const sampleDoc = {
      marker,
      type: 'backup-restore-smoke',
      createdAt: new Date(),
      payload: {
        supplier: 'smoke supplier',
        qty: 7,
        unitPrice: 15
      }
    };

    await collection.insertOne(sampleDoc);

    const docsToBackup = await collection.find({ marker }).toArray();
    fs.writeFileSync(backupFile, JSON.stringify(docsToBackup, null, 2), 'utf8');

    await collection.deleteMany({ marker });

    const backupPayload = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    if (!Array.isArray(backupPayload) || backupPayload.length === 0) {
      throw new Error('Backup file is empty.');
    }

    const docsToRestore = backupPayload.map((doc) => {
      const { _id, ...rest } = doc;
      return rest;
    });

    await collection.insertMany(docsToRestore);
    const restoredCount = await collection.countDocuments({ marker });

    if (restoredCount !== docsToRestore.length) {
      throw new Error(`Restore verification failed: expected ${docsToRestore.length}, got ${restoredCount}`);
    }

    console.log('Backup/restore smoke test passed', {
      marker,
      restoredCount,
      backupFile
    });

    await collection.deleteMany({ marker });
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Backup/restore smoke test failed:', error.message);
  process.exit(1);
});
