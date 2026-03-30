# Backup and Restore Runbook

## Scope
This runbook covers data safety for MongoDB-backed backend data, with focus on:
- Spare parts
- Orders
- Purchase orders

## Backup Policy (Recommended)
1. Use MongoDB Atlas replica set (or self-hosted replica set) with majority write concern.
2. Enable automated snapshots at least daily.
3. Keep point-in-time recovery (PITR) enabled.
4. Keep backups for at least 30 days.
5. Run weekly backup verification and monthly restore drill.

## Manual Backup Commands
Use these commands from a machine with MongoDB tools installed.

```bash
mongodump --uri "$MONGO_URI" --archive=./backups/carter-$(date +%F).archive --gzip
```

Optional JSON export for one collection:

```bash
mongoexport --uri "$MONGO_URI" --collection purchaseorders --out ./backups/purchaseorders-$(date +%F).json
```

## Restore Commands
Full archive restore:

```bash
mongorestore --uri "$MONGO_URI" --archive=./backups/carter-YYYY-MM-DD.archive --gzip --drop
```

Collection restore (JSON via mongoimport):

```bash
mongoimport --uri "$MONGO_URI" --collection purchaseorders --file ./backups/purchaseorders-YYYY-MM-DD.json --jsonArray --drop
```

## Tested Restore Example (in this repo)
A smoke-test script is included and can be run with:

```bash
npm run backup:restore-smoke
```

What it does:
1. Inserts a marker document into `backup_restore_smoke` collection.
2. Writes a JSON backup file to `backend/backups/`.
3. Deletes the marker docs from DB.
4. Restores from the JSON file.
5. Verifies restored document count.
6. Cleans up marker docs.

Script path:
- `backend/src/scripts/backupRestoreSmoke.js`

## Recovery Checklist
1. Confirm incident scope (which collections/time window).
2. Freeze write traffic if data corruption is ongoing.
3. Restore into a staging DB first and validate record counts.
4. Validate critical business paths:
   - Spare part inventory lookups
   - Purchase order listing
   - Order listing
5. Restore to production only after validation sign-off.
6. Log recovery summary (time, source backup, restored collections, validation result).

## Notes
- Soft delete is enabled for spare parts, orders, and purchase orders. Deletion endpoints now mark records deleted instead of hard removal.
- Destructive and critical write routes are protected by auth and DB connectivity guards.
