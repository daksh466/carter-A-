# User Onboarding Runbook

## Goal
Roll out to real users safely while collecting actionable product feedback.

## Phase Plan

### Phase 1: Internal Pilot (Day 1-3)
- Audience: internal team and power users.
- Limit: 10-20 users.
- Entry criteria:
  - deployment checks passed
  - smoke checks passed
  - support owner assigned
- Exit criteria:
  - no critical bugs for 48 hours
  - p95 latency under threshold
  - error rate remains low and stable

### Phase 2: Controlled Beta (Day 4-10)
- Audience: selected customer cohort.
- Limit: 50-100 users.
- Actions:
  - daily review of feedback
  - triage issues by severity
  - publish fixes in small batches
- Exit criteria:
  - core workflows are consistently successful
  - no unresolved P0/P1 defects

### Phase 3: General Availability
- Audience: all target users.
- Actions:
  - announcement + quick-start guide
  - dashboard-based monitoring
  - weekly UX iteration cadence

## Mandatory Checks Before Each Phase
1. Run all tests:
   - npm run test:all
2. Run deployment health checks:
   - npm run perf:guard
   - npm run onboarding:smoke
3. Confirm process health:
   - npx pm2 ls
4. Confirm endpoint availability:
   - GET /api/health
   - GET /api/metrics (with policy in effect)
5. Confirm debug toggles disabled in target env:
   - SPAREPART_BATCH_DEBUG=false
   - TRANSFER_DEBUG=false

## Operational Guardrails
- Keep staged rollout percentages and avoid all-at-once enablement.
- Freeze non-critical changes during onboarding windows.
- Roll back immediately on critical regression.

## Core Workflow Validation Set
Validate these flows with real sample users in each phase:
1. Create inventory/spare part
2. Create transfer
3. Receive transfer
4. FEFO behavior remains correct after receive

## Feedback Collection
- Capture feedback in three buckets:
  - usability friction
  - functional bugs
  - performance issues
- Use template: documentation/USER_FEEDBACK_TEMPLATE.md
- Tag each item with:
  - severity (critical/high/medium/low)
  - workflow area
  - reproducibility

## Daily Triage Cadence
- 15-minute standup for incidents and blockers.
- 30-minute product+engineering feedback review.
- Publish daily changelog for pilot users.

## Rollback Triggers
Roll back onboarding scope immediately if any occur:
- core workflow failure rate spikes
- repeated PM2 restarts or unstable process state
- sustained latency over p95 threshold
- data integrity risk in transfer/receive flow
