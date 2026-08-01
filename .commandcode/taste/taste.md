# Architecture
- Keep optimistic-update and conflict-resolution logic isolated in a single clearly-commented module (e.g., lib/expenseSync.ts) — do not bury it inside components. Confidence: 0.90
- Write core business logic (balance calculations, currency formatting, exchange rate conversion) as pure exported functions with unit tests. Confidence: 0.85
- Use Zustand with persist + AsyncStorage for local preferences (theme, home currency, etc.). Confidence: 0.75
- Use React Query (TanStack) for server state with optimistic mutations. Confidence: 0.80

# Tech Stack
- Use Expo + Expo Router + TypeScript (strict mode) + NativeWind for styling. Confidence: 0.90
- Use Supabase for backend: Postgres, Auth, Realtime (postgres_changes channels), RLS. Confidence: 0.90
- Use React Hook Form + Zod for form validation. Confidence: 0.75

# UI / Styling
- Use NativeWind classes for all styling — do not inline styles or use StyleSheet.create. Confidence: 0.85
- Extract repeated UI patterns (icon-avatar row, segmented control, balance card, list rows) into reusable components under components/ui/. Confidence: 0.80
- UI/visual changes must not touch data flow, React Query hooks, Supabase calls, or optimistic-update/conflict-resolution logic — keep visual and data layers strictly separated. Confidence: 0.85
- Animations should be subtle: use FadeIn (not FadeInDown), short durations (~200-260ms), minimal stagger delays, and snappy press-scale with low scale factor (~0.985). Confidence: 0.75
- Use consistent design tokens: Ledger green (#2F5D50), Rust (#B54A3A), navy, ink, paper — with semantic color usage (red/warm for "you owe", green for "owed to you"). Confidence: 0.80

# Workflow
- Ask for Supabase project URL and anon key rather than hardcoding placeholders. Confidence: 0.85
- Build in phases, pausing for user confirmation before moving to the next phase. Confidence: 0.80
- Verify features work on-device (Expo Go or dev build) before considering a phase complete. Confidence: 0.75
- When Expo/RN dev server fails to start: check for port conflicts, set autoPort in .claude/launch.json, and remove hardcoded port flags from start commands. Confidence: 0.70

# Supabase
- Use database triggers + pg_net for push notification webhooks from Postgres changes, with edge functions for FCM/APNs delivery. Confidence: 0.75
- Deno Edge Functions cannot import from the app's lib/ directory — duplicate necessary constants/lookup tables in the edge function with a comment explaining why. Confidence: 0.70
- Enable Row Level Security (RLS) for multi-tenant data isolation — a user can only read/write rows for groups they're a member of. Confidence: 0.80
