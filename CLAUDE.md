# CLAUDE.md — SplitStream

Project instructions for Claude Code. Read this before making changes, and re-read it if a session gets long.

## What this project is

SplitStream — a real-time collaborative expense-splitting app built with React Native (Expo). Full spec lives in `./splitstream-prd.md`. This is a portfolio/resume project: the real-time sync + optimistic UI + conflict resolution logic is the whole point, so protect its clarity even if that means writing less code elsewhere.

## Build process — follow phases strictly

Build in the phases defined in Section 12 of the PRD:

1. Foundation (scaffold, auth)
2. Groups
3. Expenses (core CRUD + optimistic mutations)
4. Real-time layer (Supabase Realtime + conflict resolution)
5. Polish

**Do not start the next phase until I explicitly confirm the current one works.** If you think a phase is done, stop, summarize what you built and how to test it, and wait for me.

## Stack — do not substitute these

- Expo + Expo Router, TypeScript in strict mode
- NativeWind for all styling — no StyleSheet.create, no inline style objects unless NativeWind genuinely can't express it
- Zustand for local/UI state
- React Query for all server state and caching
- Supabase for Postgres, Auth, and Realtime
- React Hook Form + Zod for any form/validation

## Non-negotiable architecture rule

All optimistic-update and conflict-resolution logic must live in `lib/expenseSync.ts` as a standalone, clearly commented module — not inlined in components or hooks. I need to be able to open this one file and explain the entire sync/conflict strategy in a job interview. If a change touches this logic, keep it isolated there and comment the _why_, not just the _what_.

## Data model

Follow the schema in PRD Section 7 exactly (profiles, groups, group_members, expenses — including the `version` integer column on `expenses` used for conflict detection). Don't add columns or tables not in the PRD without checking with me first.

## Environment / secrets

- Never hardcode a Supabase URL or anon key as a placeholder and move on — stop and ask me for the real values.
- Keep them in `.env` (Expo public env vars prefixed `EXPO_PUBLIC_`), and make sure `.env` is gitignored.

## Testing expectations

- The balance-calculation function must be a pure, exported function with unit tests — this is a talking point for interviews, so it needs to actually be tested, not just "look correct."
- Before marking Phase 4 done, walk me through manually testing concurrent edits with two simulators/devices as a checklist — this is the core demo scenario.

## Style/scope discipline

- No push notifications, payment settlement, multi-currency, receipt OCR, or web version — these are explicitly out of scope per the PRD. If you think one is needed, ask first rather than adding it.
- Prefer fewer, well-explained files over maximal abstraction. This needs to be walkable in a live interview, not just functional.
