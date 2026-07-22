# SplitStream

A real-time collaborative expense-splitting app for small groups (roommates, trips, friends). Log a shared expense on one phone and everyone else's balances update **live** — no refresh. Two people editing the same expense at once resolve without data loss, and every change lands on the sender's screen instantly, before the server confirms it.

Built with Expo (React Native) + Supabase.

> **Why this project exists:** it's a focused demonstration of three things that are hard to get right — **WebSocket real-time sync, optimistic UI with rollback, and concurrency conflict resolution** — rather than a wide feature surface. The interesting code is deliberately concentrated in a few well-commented files (see [The engineering story](#the-engineering-story)).

---

## Demo

<!-- Add a screen recording or GIF here — ideally two phones side by side showing
     a live expense appearing on the second device, and the conflict toast. -->

_Two-device demo coming soon._

---

## Features

- **Auth** — email/password and **Sign in with Google** (Supabase Auth).
- **Groups** — create a group, invite by 6-character code or **QR scan**, see your live net balance per group.
- **Expenses** — add / edit / delete with **categories** (food, travel, rent…), equal split, real-time list.
- **Real-time sync** — other members' changes appear within ~1s over a WebSocket, merged straight into the cache (no refetch).
- **Optimistic UI** — your changes show immediately with a "syncing" state, reconcile on success, roll back with a toast on failure, and **queue while offline** (sync on reconnect).
- **Conflict resolution** — concurrent edits to the same expense use version-based optimistic concurrency control; the losing edit is rejected (never silently clobbered) and told so.
- **Settle up** — record payments between members, including **partial payments**.
- **Balances** — derived client-side by a pure, unit-tested function; exact zero-sum by construction.
- **Activity feed** — append-only per-group log ("Bob added ₹500 for dinner"), written only by DB triggers.
- **Push notifications** — new activity notifies other members (Expo Push → FCM), tap to deep-link into the group.
- **Stats** — per-group spend-by-category and 6-month trend charts.
- **Dark mode** — system / light / dark, persisted.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Expo (React Native `0.86`), Expo Router `~57` |
| Language | TypeScript, strict mode |
| Server state | TanStack React Query (optimistic cache) |
| Local/UI state | Zustand |
| Backend | Supabase — Postgres, Auth, Realtime, Edge Functions |
| Styling | NativeWind (Tailwind for RN) |
| Forms | React Hook Form + Zod |
| Push | expo-notifications + Expo Push Service + FCM |
| Testing | Jest (`jest-expo`) |

---

## The engineering story

Three files carry the weight of this project. If you're reviewing the code, start here.

### 1. Optimistic updates + conflict resolution — [`lib/expenseSync.ts`](lib/expenseSync.ts)

Every mutation follows the same three-phase pattern via React Query:

1. **`onMutate`** — write to the cache *before* the network call, so the author's UI responds instantly. Optimistic rows carry a client-only `_optimistic` flag the UI renders as a "syncing" indicator. A snapshot of the previous cache is captured for rollback.
2. **`onSuccess`** — reconcile: the server's authoritative row (real id, version, timestamps) replaces the temporary optimistic row in place. No refetch on the happy path — the cache is maintained surgically so the list never flickers.
3. **`onError`** — restore the snapshot and toast.

**Conflict resolution** is optimistic concurrency control on a `version` column. An update is a compare-and-set:

```sql
UPDATE expenses SET ..., version = version + 1
WHERE id = ? AND version = ?      -- the version we last read
```

If someone else edited first, the `WHERE` matches zero rows — the stale write is **rejected by construction**, surfaces as a `ConflictError`, and the loser gets a toast ("This expense was updated by someone else…") plus a refetch of the winning value. This is last-write-wins where a "write" must have seen the latest version.

### 2. Real-time merge — same file, `useGroupRealtime`

One Supabase Realtime channel per open group subscribes to `postgres_changes` on `expenses` **and** `settlements`, filtered by `group_id`. Incoming events merge into the *same* React Query cache the local mutations maintain, through shared cache helpers — so "my optimistic write" and "everyone else's live events" converge on one consistent list. RLS applies to the subscription too: you only ever receive rows for your own groups.

### 3. Balance math — [`lib/balances.ts`](lib/balances.ts) (pure + [tested](lib/__tests__/balances.test.ts))

`computeBalances(expenses, memberIds, settlements)` is a pure function: no I/O, memoized with `useMemo`, recomputed on every cache change (including optimistic ones, so balances react instantly). Two details that the unit tests drove out:

- **Exact zero-sum.** Rounding each member independently can leave the group a paisa off zero. The residual is assigned to the largest balance (largest-remainder method), so balances sum to *exactly* zero.
- **Settlements** shift money pairwise (payer's net up, receiver's down); partial payments are just smaller shifts.

### Bonus: multi-tenant security — [`supabase/phase2.sql`](supabase/phase2.sql)

Row Level Security scopes every row to the groups you belong to. Two decisions worth calling out:

- **Recursion-free policies.** A naive "members can read their group's membership" policy would query `group_members` inside its own policy — Postgres rejects that. A `SECURITY DEFINER` helper (`is_group_member`) does the lookup with RLS bypassed, and the policies call it.
- **Create/join via RPCs, not raw inserts.** Creating a group must atomically insert the group *and* the creator's membership; and a non-member can't `SELECT` a group they're trying to join, so the invite code acts as the credential inside a `SECURITY DEFINER` function. There are deliberately no client-side write policies for these paths.

---

## Project structure

```
app/                        # Expo Router screens
  index.tsx                 # "/" → redirect to groups or login based on session
  (auth)/                   # login, signup
  (tabs)/
    groups/
      index.tsx             # groups list with live per-group balances
      [groupId]/
        index.tsx           # group detail: balance hero, transactions, filters
        add-expense.tsx     # add/edit expense (categories, payer)
        settle.tsx          # record a (possibly partial) payment
        members.tsx         # invite code + QR + member list
        activity.tsx        # activity feed
        stats.tsx           # spend charts
      create.tsx / join.tsx / scan.tsx
    profile.tsx             # identity, theme toggle, sign out
lib/
  expenseSync.ts            # ★ optimistic mutations + realtime + conflict resolution
  balances.ts              # ★ pure balance/settlement math (unit tested)
  stats.ts                 # pure spend aggregations (unit tested)
  groups.ts                # group queries + create/join RPC hooks
  activity.ts, notifications.ts, oauth.ts, categories.ts,
  authStore.ts, themeStore.ts, toastStore.ts, supabase.ts, types.ts
components/ui/              # design-system kit: BalanceHero, ListRow, SegmentedControl, …
supabase/
  phase1.sql … phase8.sql   # schema, RLS, triggers, realtime, webhook (run in order)
  functions/notify-activity # Edge Function: fans activity out as push
```

---

## Data model

`profiles`, `groups`, `group_members`, `expenses` (with a `version` column for conflict detection and a `category`), `settlements`, `activity_log` (append-only, trigger-written), `push_tokens`. Full SQL in [`supabase/`](supabase/), applied as ordered phases.

---

## Running locally

### Prerequisites

- Node 18+, and the Expo tooling (`npx expo`)
- A free [Supabase](https://supabase.com) project

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials (Dashboard → Project Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Database

In the Supabase Dashboard → SQL Editor, run the numbered files in [`supabase/`](supabase/) **in order** — `phase1` → `4`, then `6` and `7` (there's no `phase5`; that milestone was app-only polish). Each sets up a slice of the schema: profiles/auth → groups/RLS → expenses → realtime → categories/activity → settlements. Then, under Authentication, enable Email (turn off "Confirm email" for a fast dev loop). `phase8` is the push webhook — see step 5.

### 4. Run

```bash
npx expo start
```

Open in Expo Go for everyday development. **Push notifications and Google sign-in require a development build** (they use native modules Expo Go doesn't ship) — see below.

### 5. Push notifications (optional, needs a dev build)

1. `eas init` then `eas build --profile development --platform android`, install the APK.
2. Firebase: register an Android app (package `com.sidharthbhasin.splitstream`), add `google-services.json`, upload the FCM V1 service-account key at expo.dev credentials.
3. Deploy the Edge Function: `supabase functions deploy notify-activity --no-verify-jwt`, set a `WEBHOOK_SECRET`, and run [`supabase/phase8.sql`](supabase/) (the trigger that calls it — replace the secret placeholder first).

### 6. Google sign-in (optional)

Create a **Web** OAuth client in Google Cloud (redirect URI = `<project>.supabase.co/auth/v1/callback`), enable the Google provider in Supabase with the client id/secret, and allow-list `splitstream://**` and `exp://**` under Auth → URL Configuration.

---

## Testing

```bash
npm test
```

The suite covers the pure business logic — balance/settlement calculation and stats aggregation — the parts where correctness actually matters. Balance math is a pure function precisely so it can be tested in isolation.

---

## Notes & scope

- **Not** a payments app — settle-up is bookkeeping; no real money moves.
- Equal splits only (custom splits are a documented future stretch goal).
- Single currency (₹).
- Full product spec lives in [`splitstream-prd.md`](splitstream-prd.md); Section 15 covers the post-v1 additions (QR, activity/push, categories, dark mode, charts, settle-up, Google auth).
