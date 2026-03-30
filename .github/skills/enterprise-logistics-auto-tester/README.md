# Enterprise Logistics Auto Tester

A production-grade QA automation framework for enterprise logistics systems. Simulates complete shipment workflows, validates inventory consistency, and tests edge cases across stores, machines, and spare parts.

## Features

✅ **Full System Simulation**: Creates 5 stores, 12-20 machines, 10+ spare parts with realistic relationships  
✅ **Complete Workflow Testing**: Outgoing/incoming shipments, status transitions, receive confirmations  
✅ **Inventory Validation**: Stock tracking, consistency checks, duplicate detection  
✅ **Machine-Part Integrity**: Verifies correct spare part assignments across stores  
✅ **Edge Case Testing**: Overflow attempts, invalid references, duplicate handling  
✅ **Stress Testing**: Repeats complex flows to catch regressions  
✅ **Hybrid Approach**: API for fast setup + Playwright for critical UI flows  
✅ **Fail-Fast Strategy**: Stops on first critical error with detailed context  
✅ **Comprehensive Reporting**: JSON (CI/CD) + Markdown (human readable)  
✅ **Database Reset**: Deterministic clean state before each run  

## Quick Start

### Installation
```bash
cd .github/skills/enterprise-logistics-auto-tester

# Install dependencies
npm install
```

### Configuration
Create `.env.test` in project root:
```bash
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
DB_RESET_ENABLED=true
DB_CONNECTION_STRING=mongodb://localhost:27017/logistics-test
REPORT_DIR=reports/test-results
HEADLESS=true  # Set to false for debugging with browser UI
VERBOSE=false  # Set to true for detailed logging
```

### Run Tests

```bash
# Full test suite with DB reset
npm test

# Quick validation (steps 1-5 only)
npm run test:quick

# Shipment workflows only (steps 6-9)
npm run test:shipments

# Edge cases (step 12)
npm run test:edge-cases

# Stress test (step 13)
npm run test:stress
```

### Advanced Usage

```bash
# Run specific steps
node scripts/main.js --steps 6-9

# Disable database reset
node scripts/main.js --full --no-reset-db

# Verbose logging
node scripts/main.js --full --verbose

# Headless browser off (for UI debugging)
HEADLESS=false node scripts/main.js --full
```

## Test Workflow (13 Steps)

| Step | Description | Type |
|------|-------------|------|
| 1 | Create 5 stores | API |
| 2 | Create 12-20 machines | API |
| 3 | Create 10 spare parts | API |
| 4 | Assign spares to machines | API |
| 5 | Seed initial inventory | API |
| 6 | Create outgoing shipments | API |
| 7 | Create incoming shipments | API |
| 8 | Confirm shipment receipts | API |
| 9 | Validate transfer integrity | API |
| 10 | Validate machine-part links | API |
| 11 | Check inventory consistency | API |
| 12 | Test edge cases | API |
| 13 | Stress test (repeat flows) | API |

**Estimated Duration**: 60-90 seconds

## Reports

Reports are generated in `reports/test-results/`:

### JSON Report (Machine-Readable)
```
test-run-2026-03-29T14-23-45.json
```
Contains:
- Status (PASS/FAIL)
- Duration
- All metrics (stores, machines, shipments, etc.)
- Detailed error list
- Step-by-step results

### Markdown Report (Human-Readable)
```
test-run-2026-03-29T14-23-45.md
```
Contains:
- Summary (status, pass rate)
- Metrics table
- Step results (✅/❌)
- Error details with context
- Warnings

## Prerequisites

- **Node.js 16+** and npm
- **Backend running** on `localhost:5000`
- **Frontend running** on `localhost:3000` (for UI tests)
- **MongoDB** available at `mongodb://localhost:27017/logistics-test` (for DB reset)
- **Test database permissions** (create, drop, clear collections)

## Architecture

### Scripts

- **main.js** — Orchestrator: runs all 13 steps, error handling, report generation
- **api-helpers.js** — HTTP wrappers with retry logic (3 attempts, exponential backoff)
- **db-reset.js** — Database utilities (connect, clear, verify clean state)
- **playwright-helpers.js** — Browser automation (shipments, receive flows, UI validation)
- **report-generator.js** — JSON + Markdown report generation

### References

- **api-endpoints.md** — Complete endpoint reference with payloads and error codes
- **payload-templates.md** — JSON examples, cURL commands, test data constraints

## Error Handling

### Fail-Fast Strategy
If ANY critical step fails:
1. Error is logged with full context
2. Execution stops immediately
3. Report marks as FAIL
4. Reports generated with error details

**No silent skips** — every step is verified before proceeding.

### Retry Logic
Network flakiness is handled automatically:
- 3 attempts per API call
- Exponential backoff: 1s, 2s, 3s
- 4xx/5xx errors fail immediately (no retry)

### Common Errors

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `ECONNREFUSED` | Backend not running | `npm start` in backend dir |
| `Spa spare part creation failed: no ID returned` | API response schema mismatch | Update api-helpers.js response parsing |
| `Database connection lost` | MongoDB not running | Check MongoDB connection string |
| `Confirm Receive button not found` | UI selector mismatch | Update playwright-helpers.js selectors |

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Logistics Auto Tester

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:5.0
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'  --quiet"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          cd .github/skills/enterprise-logistics-auto-tester
          npm install

      - name: Run auto tester
        run: |
          cd .github/skills/enterprise-logistics-auto-tester
          npm test
        env:
          API_BASE_URL: http://localhost:5000
          DB_CONNECTION_STRING: mongodb://localhost:27017/logistics-test

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: reports/test-results/
```

## Debugging

### Enable Verbose Logging
```bash
VERBOSE=true npm test
```

### Show Browser UI (Playwright)
```bash
HEADLESS=false npm run test:shipments
```

### Take Screenshots on Failure
The Playwright helpers include `takeScreenshot()` — modify playwright-helpers.js to capture UI state before errors.

### Inspect Database State
```bash
node scripts/db-reset.js --verify-only
```

## Extending the Tester

### Add New Test Steps
1. Create function `stepN_description()` in main.js
2. Add to `steps` array
3. Use `report.recordStepCompletion()` for tracking
4. Call `api.*` or `playwright.*` helpers

### Add Custom API Endpoints
Extend `LogisticsAPI` class in api-helpers.js:
```javascript
async customOperation(payload) {
  const result = await this.client.post('/api/custom', payload);
  return result;
}
```

### Modify Test Data
Edit `step5_seedInventory()` and `step13_stressTest()` to customize:
- Stock quantities
- Shipment routes
- Spare part names
- Number of iterations

## Troubleshooting

### Tests Time Out
Increase `TIMEOUT` in playwright-helpers.js:
```javascript
const TIMEOUT = 60000; // 60s instead of 30s
```

### Database Not Resetting
Verify connection string and permissions:
```bash
mongosh mongodb://localhost:27017/logistics-test --eval "db.adminCommand('ping')"
```

### Shipment UI Actions Fail
Update selectors in playwright-helpers.js to match your frontend:
```javascript
const submitBtn = await page.$('button.my-custom-class');
```

## Support & Issues

- **Bug Reports**: Include full JSON report and verbose logs
- **Feature Requests**: Describe test scenario and expected behavior
- **Questions**: Check api-endpoints.md and payload-templates.md first

## Performance Baseline

| Metric | Target | Actual |
|--------|--------|--------|
| Total Duration | < 120s | ~90s |
| API Calls (avg) | < 200ms | ~50ms |
| DB Reset Time | < 5s | ~2s |
| Playwright Actions | < 2s each | ~1.5s |

## License

Proprietary — Enterprise Logistics Platform

---

**Last Updated**: March 29, 2026  
**Version**: 1.0.0  
**Maintained By**: QA Automation Team
