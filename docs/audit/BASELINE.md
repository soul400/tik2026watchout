# LivePulse Intelligence — Baseline Audit Report

**Date:** October 16, 2026  
**Environment:** Next.js 15.0.3 App Router, TypeScript 5.7.2, Prisma ORM 5.22.0, SQLite WAL, Node.js v22.17.1 (Windows)  
**Repository Branch:** `master`  
**Latest Baseline Commit:** `21b1743f` (feat(dashboard): replace historical leaderboard with auto-renewing Live Stream Supporters Board)  
**Database File:** `prisma/dev.db` (2.02 GB, SQLite WAL enabled)  
**Backup Snapshot:** `prisma/dev.db.bak` (2,023.16 MB, verified intact with `PRAGMA integrity_check: ok`)

---

## 1. Runtime and Tooling Inventory

| Component | Specified Version | Verified Status |
| :--- | :--- | :--- |
| **Node.js** | >= 18 (Current: v22.17.1) | Verified functional |
| **Next.js** | 15.0.3 (App Router) | Verified build succeeds (`npm run build` -> exit code 0) |
| **TypeScript** | 5.7.2 | Strict mode enabled, 0 type errors |
| **Prisma ORM** | 5.22.0 | Client generated, schema synchronized |
| **Database** | SQLite 3 (`prisma/dev.db`, WAL Mode) | 2.02 GB size, 118,600+ raw events, 6,860+ supporters |
| **Test Runner** | Vitest v2.1.9 (`--fileParallelism=false`) | 4 suites, 47 tests passing (100%) |
| **TikTok Connector** | `tiktok-live-connector` v2.5.0 | Direct WebSocket / Protobuf ingestion adapter |
| **UI Framework** | Tailwind CSS 3.4.16, Radix UI primitives, Lucide React, Recharts | Arabic (RTL) layout verified |

---

## 2. Ingestion & Application Start Mechanisms

- **Next.js Application:** `npm run dev` (`next dev`) or `npm start` (`next start`).
- **Ingestion Worker:** `npm run worker` (`tsx src/workers/ingestion-worker.ts`). Connects directly to TikTok live stream via `tiktok-live-connector` with zero-cookie direct ingestion.
- **Database Migrations:** `npm run db:push` (`prisma db push`) and `npm run db:seed` (`tsx prisma/seed.ts`).
- **Test Suite:** `npm test` (`vitest run --fileParallelism=false`).

---

## 3. Verified Baseline vs. Gaps Summary

### 3.1 Verified Working Functionality
1. **Direct Event Ingestion:** `RealTikTokConnectorAdapter` connects and receives live events (gift, chat, like, share, roomUser, linkMicBattle, awardCardNotice, useCard).
2. **Authoritative Team Allocation & Conflict Defense:** Verified rejection of opponent supporters (Team 2) and conflicting team markers during battles.
3. **Double-Spend & Concurrency Protection:** Race-condition handling catching Prisma `P2002` error on `sourceEventId` in `SmartInventoryService`.
4. **Organic Community Champions Scoring:** Gifts/diamonds are strictly excluded (0%), scoring solely on presence (35%), comments (25%), likes (15%), shares (15%), and mentions (10%).
5. **STQI Engine (Hourly Riyadh Analytics):** Calculates Stream Time Quality Index normalized across 24 hours in `Asia/Riyadh` timezone.
6. **Telegram Automated Alerts:** VIP entry notifications, battle score updates throttling, and manual test alerts.
7. **Production Build:** Next.js 15 production build passes completely with zero route errors.

### 3.2 Implemented But Unverified / Partially Implemented Functionality
1. **Stream Health Monitor:** Currently basic connection logs in worker, lacking a centralized health monitoring service and dashboard metrics for event processing latency, backlog, and reconnection telemetry.
2. **Inventory Movement Ledger (2.0):** `ToolConsumption` and `ExternalActivation` exist, but there is no explicit ledger tracking all 6 lifecycle movement types (`ACQUISITION`, `USAGE`, `DEDUCTION`, `EXPIRATION`, `REVERSAL`, `CORRECTION`) with periodic ledger reconciliation.
3. **Centralized Analytical Reports Service:** Reports page currently has basic client-side tables; lacks server-side streaming export for CSV, XLSX, and PDF management summaries.
4. **Enigma Identity Model:** Relies heavily on a single `confidenceScore` percentage rather than structured evidence categories (`IDENTIFIER_MATCH`, `METADATA_MATCH`, `BEHAVIORAL_SIMILARITY`, `UNCONFIRMED_ASSOCIATION`).
5. **Telegram Command Center:** Telegram service sends outbound alerts, but does not support inbound command webhooks/polling (`/status`, `/session`, `/inventory`, `/battle`, `/report`, `/alerts`) with strict allowlist authorization.
6. **LivePulse Copilot (P2):** Not yet implemented; requires safe read-only tool grounding against existing services without raw SQL or arbitrary mutations.
7. **Four Decision Layers in UX:** Dashboard is rich but needs clearer visual layering:
   - Layer A: What is happening now?
   - Layer B: What requires attention?
   - Layer C: What should I do next?
   - Layer D: Are we improving?
