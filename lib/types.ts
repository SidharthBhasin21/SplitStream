/**
 * TypeScript mirrors of the Postgres schema (PRD Section 7).
 * Keep these in sync with the SQL in supabase/ — they are the single
 * source of truth for row shapes across the app.
 */

export interface Profile {
  id: string; // uuid, references auth.users
  name: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string; // 6-character shareable code
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
}

/** v1 supports equal splits only; 'custom' is a v2 stretch goal. */
export type SplitType = "equal";

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number; // numeric(10,2) in Postgres
  paid_by: string | null;
  split_type: SplitType;
  /** v1.1 — one of lib/categories.ts CATEGORIES; 'other' for legacy rows. */
  category: string;
  /** Incremented on every update — the basis for conflict detection (PRD 5.4). */
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** v1.1 — append-only feed rows, written only by DB triggers (phase6.sql). */
export type ActivityAction =
  | "expense_added"
  | "expense_edited"
  | "expense_deleted"
  | "member_joined";

export interface ActivityEntry {
  id: string;
  group_id: string;
  actor_id: string | null;
  action: ActivityAction;
  details: { description?: string; amount?: number };
  created_at: string;
}
