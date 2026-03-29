# Changelog

## [0.2.0]() (2026-03-29)

### 🚀 Features

- add vitest integration test config (5ee2f26)
- add Dockerfile and Docker Compose production config (9fb8127)
- add admin dashboard with all pages (overview, subscribers, rewards, experiments, webhooks, settings) (a3eedf7)
- add @waitlist/react components (WaitlistForm, ReferralStatus, Provider) (8285ffb)
- add @waitlist/widget drop-in embeddable script (9e33564)
- add @waitlist/sdk headless client package (4d04b91)
- add admin analytics endpoints (overview, timeseries, cohorts, channels) (ad5dfec)
- add admin endpoints for subscribers, rewards, webhooks, experiments (5dd4f6f)
- add admin auth (setup/login) and project CRUD endpoints (2347529)
- add BullMQ workers for analytics, webhook dispatch, and position recalc (0a96268)
- add webhook signing, delivery service, and dispatch worker (a80e04b)
- add leaderboard and stats public endpoints with Redis caching (7951d40)
- add referral tracking, position bumping, and reward unlock logic (9bc4adc)
- add waitlist service, event emitter, and subscribe endpoints (06e31b3)
- add Fastify server with Redis, BullMQ, API key and JWT middleware (b0784c4)
- add database schema with all tables and drizzle config (4126692)
- add shared types, validation schemas, and constants (6d0231d)
- scaffold monorepo with shared package and api app (0ab7faa)

### 🐛 Bug Fixes

- run integration tests serially to avoid DB/Redis conflicts (5cfa9e2)

### 📚 Documentation

- add per-package README files (a0cc609)
- add README, LICENSE (Apache 2.0), and CHANGELOG (51528e8)

### ✅ Tests

- add comprehensive integration test suite (4a1b8f5)

