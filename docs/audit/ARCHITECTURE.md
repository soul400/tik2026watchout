# LivePulse Intelligence — Architecture Audit & Flow Specification

**Date:** October 16, 2026  
**Project:** LivePulse Intelligence (`tik2026watchout`)

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph ExternalSources["External Ingestion Layer"]
        TT["TikTok LIVE Stream\n(WebSocket / Protobuf)"]
        TG["Telegram Bot API\n(Alerts & Commands)"]
    end

    subgraph Ingestion["Ingestion & Pipeline Engine"]
        Worker["Ingestion Worker\n(src/workers/ingestion-worker.ts)"]
        Adapter["TikTok Adapter\n(src/lib/tiktok-adapter.ts)"]
        Pipeline["LiveEventPipeline\n(src/lib/event-pipeline.ts)"]
        HealthMon["Stream Health Monitor\n(src/lib/stream-health.ts)"]
    end

    subgraph DomainServices["Domain & Intelligence Services"]
        BattleEng["Battle Engine & Score Resolver\n(battle-score-resolver.ts)"]
        InventoryEng["Tactical Inventory 2.0\n(smart-inventory.ts)"]
        ChampionsEng["Community Champions Engine\n(champions-engine.ts)"]
        STQIEng["STQI Engine (Asia/Riyadh)\n(stqi-engine.ts)"]
        EnigmaEng["Identity Confidence & Enigma\n(enigma-engine.ts)"]
        ReportsEng["Centralized Reports Service\n(reports-service.ts)"]
        TelegramEng["Telegram Command Center\n(telegram-service.ts)"]
        CopilotEng["LivePulse Copilot (P2)\n(copilot-service.ts)"]
    end

    subgraph DataTier["Data Persistence Tier (SQLite WAL)"]
        DB[("SQLite 3 DB\n(prisma/dev.db)")]
        PrismaClient["Prisma ORM 5.22\n(src/lib/prisma.ts)"]
    end

    subgraph Presentation["User Interface & API (Next.js 15)"]
        AppRouter["App Router (src/app/)"]
        LayerA["Layer A: What is happening now?"]
        LayerB["Layer B: What requires attention?"]
        LayerC["Layer C: What should I do next?"]
        LayerD["Layer D: Are we improving?"]
        API["Route Handlers (src/app/api/)"]
    end

    TT --> Adapter --> Worker --> Pipeline
    Worker -. Telemetry .-> HealthMon
    Pipeline --> BattleEng
    Pipeline --> InventoryEng
    Pipeline --> ChampionsEng
    Pipeline --> TelegramEng
    
    BattleEng --> PrismaClient --> DB
    InventoryEng --> PrismaClient --> DB
    ChampionsEng --> PrismaClient --> DB
    STQIEng --> PrismaClient --> DB
    EnigmaEng --> PrismaClient --> DB
    ReportsEng --> PrismaClient --> DB
    HealthMon --> PrismaClient --> DB

    DB --> PrismaClient --> API --> AppRouter
    AppRouter --> LayerA
    AppRouter --> LayerB
    AppRouter --> LayerC
    AppRouter --> LayerD
    TG <==> TelegramEng
    CopilotEng -. Read-Only Domain Calls .-> DomainServices
```

---

## 2. Ingestion Flow & Event Provenance

1. **Raw Event Arrival:**
   - Event arrives via `RealTikTokConnectorAdapter` (event types: `gift`, `chat`, `like`, `share`, `roomUser`, `linkMicBattle`, `linkMicArmies`).
   - Recorded into `RawEvent` table with unique `deduplicationKey` and `payload` JSON string.
2. **Event Normalization & Validation:**
   - Events are parsed and validated in `LiveEventPipeline`.
   - Events with missing critical fields are either enriched (e.g. supporter upsert) or safely rejected.
3. **Deterministic Idempotency Key Formulation:**
   - Format: `livepulse:{tenantId}:{battleOrSession}:{platformUserId}:{toolKey}:{upstreamEventId}`
   - If upstream event lacks reliable event ID, event is quarantined into `ExternalActivation` with `isQuarantined: true`, preventing unauthorized balance changes.
4. **Team Membership & Conflict Reconciliation:**
   - Reconciles `explicitTeam` against `BattleParticipant` and anchor platform identifiers.
   - Rejects opponent team (Team 2) supporters from receiving host tactical grants.
   - Rejects cross-tenant battles and conflicting team indicators.

---

## 3. Database Concurrency & Storage Model

- **Database Provider:** SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode=WAL`).
- **Synchronous Mode:** `NORMAL` for high throughput with data safety.
- **Busy Timeout:** 10,000ms configured on connections to prevent locked errors during concurrent read/write operations.
- **Process Boundaries:** Single Next.js application server process and one background Ingestion Worker process communicating through the shared SQLite WAL database file.
- **Transaction Safety:** Financial counters (diamonds, battle scores) and inventory updates are wrapped inside `prisma.$transaction`. Concurrency conflicts on unique constraints trigger Prisma `P2002` error handling.
