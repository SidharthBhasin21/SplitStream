# PRD: SplitStream — Real-Time Collaborative Expense Splitter

## 1. Product Overview

SplitStream is a mobile app where a group of people (roommates, trip groups, friends) can log shared expenses and see balances update **live** across everyone's device — no manual refresh. If two people add an expense at the same time, both changes land correctly with no data loss (conflict resolution), and the UI updates optimistically (instantly on the sender's screen, before server confirmation).

**Primary purpose of this project:** demonstrate real-time system architecture, optimistic UI, and conflict resolution — this is a portfolio/resume project, so correctness and clarity of these three things matter more than feature breadth.

## 2. Goals

- A user can create a "Group" (e.g., "Goa Trip"), invite members via a shareable code, add expenses, and see running balances ("who owes whom") update in real time for all members.
- Demonstrate: WebSocket-based real-time sync, optimistic UI updates with rollback on failure, and last-write-wins (or better) conflict resolution on concurrent edits.
- Ship as a working Expo app installable via Expo Go or a dev build, with a clean enough UI to screen-record for a portfolio/demo video.

## 3. Non-Goals (explicitly out of scope for v1)

- Payment settlement / actual money transfer (Venmo/UPI integration) — just tracking, not paying.
- ~~Push notifications (nice-to-have, not MVP).~~ *Moved into scope in v1.1 — see Section 15.*
- Multi-currency support.
- Receipt photo scanning/OCR.
- Web app version.

## 4. Target Users

Small groups (3-8 people) sharing recurring expenses — roommates or a trip group. Single persona is enough; don't over-design for scale.

## 5. Core Features (MVP Scope)

### 5.1 Auth

- Email + password or magic link auth (Supabase Auth).
- Simple profile: name, avatar (optional, can skip avatar upload for v1 — use initials).

### 5.2 Groups

- Create a group with a name.
- Join a group via a 6-character invite code.
- View list of groups user belongs to, each showing net balance ("you're owed ₹500" / "you owe ₹200").

### 5.3 Expenses

- Add an expense: description, amount, paid-by (defaults to self), split type (equal split only for v1 — no custom splits yet, that's a v2 stretch goal).
- Edit/delete an expense (only by the person who created it, for v1 simplicity).
- Expense list per group, real-time — sorted by most recent.

### 5.4 Real-Time Sync (the core engineering demo)

- When User A adds/edits/deletes an expense, User B and C's screens update within ~1 second, no pull-to-refresh.
- **Optimistic UI:** when the local user submits an expense, it appears in their list immediately (marked with a subtle "syncing" indicator), then reconciles with the server response. On failure, it's rolled back with an error toast.
- **Conflict handling:** if two users edit the _same_ expense concurrently, use a `version` integer column + last-write-wins with a toast notification to the "losing" editor ("This expense was updated by someone else, your edit was not applied — refresh to see the latest"). This is the detail to be able to explain clearly in interviews.

### 5.5 Balances

- Computed view per group: net balance per member, computed client-side from the expense list (don't need a separate balances table for v1 — derive it, recompute on every expense change).

## 6. Technical Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│  React Native (Expo) │◄──────►│  Supabase                │
│  - Zustand (state)   │  WS    │  - Postgres DB            │
│  - React Query       │  &     │  - Realtime (WS pub/sub)  │
│  - Optimistic cache  │  REST  │  - Auth                   │
└──────────────────────┘        └──────────────────────────┘
```

**Why Supabase:** Postgres + built-in Realtime (listens to DB changes via WAL, pushes over WebSocket) + Auth, all on a free tier. This gets you genuine real-time architecture without hand-rolling a WebSocket server — but you still design the client-side optimistic update + conflict resolution logic yourself, which is the part that's actually resume-worthy.

### Client-side data flow

1. React Query manages server state (expenses, groups) with cache.
2. On mutation (add/edit/delete expense): optimistically update React Query cache → fire Supabase insert/update → on success, reconcile; on error, roll back cache.
3. Supabase Realtime channel subscribed per group (`postgres_changes` on `expenses` table filtered by `group_id`) pushes INSERT/UPDATE/DELETE events → merge into React Query cache directly (avoids refetch, keeps it feeling instant).
4. Balance calculations are a pure function run client-side over the expenses array, memoized with `useMemo`.

## 7. Data Model (Postgres / Supabase)

```sql
-- users handled by Supabase Auth (auth.users)

create table profiles (
  id uuid references auth.users primary key,
  name text not null,
  created_at timestamptz default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null, -- 6 char code
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  paid_by uuid references profiles(id),
  split_type text default 'equal', -- future: 'custom'
  version integer default 1,       -- for conflict resolution
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Enable Row Level Security (RLS): a user can only read/write rows for groups they're a member of. This is also a good resume line ("implemented RLS policies for multi-tenant data isolation").

## 8. Screens & Navigation (Expo Router)

```
app/
  (auth)/
    login.tsx
    signup.tsx
  (tabs)/
    groups/
      index.tsx          -- list of user's groups
      [groupId]/
        index.tsx        -- expense list + balances for a group
        add-expense.tsx  -- modal/screen to add expense
        members.tsx      -- invite code, member list
      create.tsx         -- create new group
    profile.tsx
```

## 9. Realtime Event Contract

Subscribe per group screen:

```js
supabase
  .channel(`group:${groupId}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "expenses",
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      // payload.eventType: INSERT | UPDATE | DELETE
      // merge into React Query cache for ['expenses', groupId]
    },
  )
  .subscribe();
```

Conflict resolution on UPDATE: client checks incoming `version` against local cached `version`. If incoming version doesn't match what the client expected (i.e., someone else updated first), discard local optimistic change and show the toast described in 5.4.

## 10. Tech Stack

| Layer     | Choice                                                      |
| --------- | ----------------------------------------------------------- |
| Framework | Expo (React Native), Expo Router                            |
| State     | Zustand (local/UI state) + React Query (server state/cache) |
| Backend   | Supabase (Postgres, Auth, Realtime)                         |
| Styling   | NativeWind (Tailwind for RN)                                |
| Forms     | React Hook Form + Zod validation                            |
| Language  | TypeScript throughout                                       |

## 11. Non-Functional Requirements

- Real-time updates should reflect within ~1 second under normal network conditions.
- App must handle offline gracefully: queue local optimistic changes, show a "reconnecting" indicator, sync on reconnect (React Query's built-in retry/online-manager is sufficient for v1 — don't over-engineer a full offline queue here, that's a separate project).
- TypeScript strict mode on.
- No crashes on empty states (no groups yet, no expenses yet) — design empty states explicitly.

## 12. Build Phases (suggested milestones for Claude Code)

**Phase 1 — Foundation**

- Expo project scaffold, TypeScript, NativeWind, Expo Router setup.
- Supabase project connection, env config, Auth screens (login/signup).

**Phase 2 — Groups**

- Create group, join via invite code, list groups, group detail shell.
- RLS policies in Supabase.

**Phase 3 — Expenses (core feature)**

- Add/edit/delete expense with React Query optimistic mutations.
- Balance calculation logic (pure function + unit tests).

**Phase 4 — Real-time layer**

- Supabase Realtime subscription wired into React Query cache.
- Conflict resolution logic (version check + toast).
- Test with two simulators side by side to confirm live sync.

**Phase 5 — Polish**

- Empty states, loading states, error toasts, basic animations.
- Screen recording-ready UI pass for portfolio use.

## 13. Testing Notes

- Manually test concurrent edits using two simulators/devices logged in as different users in the same group — this is the key demo scenario, test it explicitly and be ready to explain what happens step by step.
- Unit test the balance-calculation function in isolation (pure function, easy to test, good to mention in interviews as "wrote tests for the core business logic").

## 14. Instructions for Claude Code

When implementing, please:

1. Set up the project structure and Phase 1 first, and pause for confirmation before moving to Phase 2.
2. Use TypeScript interfaces for all data models matching Section 7.
3. Keep the optimistic-update + conflict-resolution logic in a well-isolated, clearly-commented module (e.g., `lib/expenseSync.ts`) since this is the part I need to be able to explain in interviews — don't bury it inside component files.
4. Write the balance-calculation function as a pure, exported function with unit tests.
5. Ask me for my Supabase project URL/anon key rather than hardcoding placeholders silently.

---

## 15. v1.1 Additions (post-MVP, all five build phases shipped)

Features added after v1 was confirmed working, in scope order:

### 15.1 Invite QR codes

- Members screen shows a QR encoding `splitstream://groups/join?code=XXXXXX`.
- Join screen gains an in-app camera scanner (expo-camera); scanning feeds
  the same `join_group` RPC as typing the code. Pure parse logic in
  `lib/invites.ts` (unit tested).

### 15.2 Activity log + push notifications

- `activity_log` table: append-only per-group feed ("Bob added ₹500 for
  dinner"), written **only by Postgres triggers** on expenses/group_members
  (SECURITY DEFINER) — clients cannot forge or forget entries. RLS: members
  read their groups' feeds; nobody writes directly.
- Feed screen per group, live via a Realtime subscription (INSERT-only,
  invalidate-on-event — append-only feeds don't need surgical cache merges).
- Push notifications (supersedes the v1 non-goal): a `notify-activity`
  Supabase Edge Function is invoked by a Database Webhook on each
  activity_log INSERT and fans out via Expo's push API to every member's
  registered device except the actor. Tokens live in `push_tokens`
  (RLS: own rows only; the function uses the service role).
- Requires an EAS development build (Expo Go cannot receive remote push
  since SDK 53). In Expo Go, registration no-ops and everything else works.

### 15.3 Expense categories

- `expenses.category` text column (CHECK-constrained set: food, travel,
  rent, shopping, utilities, entertainment, other; default 'other').
- Category picker chips in add/edit expense; icon shown on expense rows.

### 15.4 Dark mode

- NativeWind `dark:` variants across all screens; class-based dark mode
  driven by a persisted Zustand theme store (System / Light / Dark toggle
  on the Profile screen); navigation chrome follows via React Navigation
  themes.

### 15.5 Stats charts

- Per-group stats screen: spend-by-category bars + last-6-months trend.
- Aggregations are pure functions in `lib/stats.ts` (unit tested, same
  pattern as `lib/balances.ts`); charts are hand-rolled Views — no charting
  dependency.

### 15.6 Schema additions (beyond Section 7)

```sql
alter table expenses add column category text not null default 'other'
  check (category in ('food','travel','rent','shopping','utilities','entertainment','other'));

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null check (action in
    ('expense_added','expense_edited','expense_deleted','member_joined')),
  details jsonb not null default '{}',
  created_at timestamptz default now()
);

create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  updated_at timestamptz default now(),
  primary key (user_id, token)
);
```
