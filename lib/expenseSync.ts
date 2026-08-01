import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useId } from "react";

import { useAuthStore } from "./authStore";
import { supabase } from "./supabase";
import { useToastStore } from "./toastStore";
import type { Expense, Settlement, SettlementKind } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  expenseSync — Lumenz's optimistic-update & conflict-resolution core
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Everything about how expense state syncs lives in this one module, by
 * design (see CLAUDE.md). The strategy:
 *
 * 1. OPTIMISTIC WRITES. Every mutation updates the React Query cache
 *    *before* the network call (`onMutate`), so the author's UI responds
 *    instantly. Optimistic rows carry a client-only `_optimistic` flag the
 *    UI renders as a subtle "syncing" indicator. Each `onMutate` snapshots
 *    the previous cache; `onError` restores it (rollback).
 *
 * 2. RECONCILE, DON'T REFETCH. On success, the server's row (real id,
 *    server timestamps, authoritative version) replaces the optimistic row
 *    in place. No invalidate/refetch on the happy path — the cache is
 *    maintained surgically so the list never flickers.
 *
 * 3. VERSIONED WRITES (optimistic concurrency control). Updates are a
 *    compare-and-set: `UPDATE ... WHERE id = ? AND version = ?`, writing
 *    `version + 1`. If another user updated first, the WHERE clause matches
 *    zero rows — the stale write is REJECTED by construction (never
 *    silently clobbered) and surfaces here as ConflictError, which the UI
 *    shows as "this expense was updated by someone else". This is
 *    last-write-wins where a "write" must have seen the latest version.
 *
 * 4. (Phase 4) REALTIME MERGE. Supabase Realtime events from other users
 *    are merged into the same cache via the cache helpers below, so both
 *    write paths — my mutations, everyone else's events — converge on one
 *    consistent list.
 */

/** An expense row as it lives in the cache. `_optimistic` is client-only:
 *  true while the row is awaiting server confirmation. */
export type CachedExpense = Expense & { _optimistic?: boolean };

/** A settlement row in the cache (v1.2) — same `_optimistic` convention. */
export type CachedSettlement = Settlement & { _optimistic?: boolean };

/** Thrown when a versioned update matches zero rows: someone else updated
 *  (or deleted) the expense after we last saw it. */
export class ConflictError extends Error {
  constructor() {
    super(
      "This expense was updated by someone else — your edit was not applied.",
    );
    this.name = "ConflictError";
  }
}

export const expenseKeys = {
  list: (groupId: string) => ["expenses", groupId] as const,
};

export const settlementKeys = {
  list: (groupId: string) => ["settlements", groupId] as const,
};

// ── Query ────────────────────────────────────────────────────────────────

export function useExpenses(groupId: string) {
  return useQuery({
    queryKey: expenseKeys.list(groupId),
    queryFn: async (): Promise<CachedExpense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ── Cache helpers ────────────────────────────────────────────────────────
// All cache surgery — for BOTH cached row kinds — goes through these
// functions. Mutations use them below; the realtime handler reuses them,
// which is what keeps the two write paths consistent.

interface CachedRow {
  id: string;
  created_at: string;
}

function setList<T extends CachedRow>(
  queryClient: QueryClient,
  key: readonly unknown[],
  update: (list: T[]) => T[],
) {
  queryClient.setQueryData<T[]>(key, (old) => update(old ?? []));
}

/** Insert a row (or replace it if already present), keeping newest-first order. */
function upsertRow<T extends CachedRow>(
  queryClient: QueryClient,
  key: readonly unknown[],
  row: T,
) {
  setList<T>(queryClient, key, (list) => {
    const rest = list.filter((r) => r.id !== row.id);
    return [...rest, row].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  });
}

/** Replace the row with id `oldId` (e.g. a temp optimistic id) by `row`.
 *  Also drops any existing row with the new id: our own INSERT can be echoed
 *  back by the realtime channel *before* the mutation's onSuccess runs, and
 *  a plain map() would then leave the row in the list twice. */
function replaceRow<T extends CachedRow>(
  queryClient: QueryClient,
  key: readonly unknown[],
  oldId: string,
  row: T,
) {
  setList<T>(queryClient, key, (list) => {
    const rest = list.filter((r) => r.id !== oldId && r.id !== row.id);
    return [...rest, row].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  });
}

/** Remove a row from a cached list. */
function removeRow(
  queryClient: QueryClient,
  key: readonly unknown[],
  id: string,
) {
  setList(queryClient, key, (list) => list.filter((r) => r.id !== id));
}

// Expense-typed wrappers (kept as the module's public cache API).
export function upsertExpense(
  queryClient: QueryClient,
  groupId: string,
  expense: CachedExpense,
) {
  upsertRow(queryClient, expenseKeys.list(groupId), expense);
}

export function replaceExpense(
  queryClient: QueryClient,
  groupId: string,
  oldId: string,
  expense: CachedExpense,
) {
  replaceRow(queryClient, expenseKeys.list(groupId), oldId, expense);
}

export function removeExpense(
  queryClient: QueryClient,
  groupId: string,
  expenseId: string,
) {
  removeRow(queryClient, expenseKeys.list(groupId), expenseId);
}

// ── Mutations ────────────────────────────────────────────────────────────

export interface AddExpenseInput {
  description: string;
  amount: number;
  paid_by: string;
  category: string;
  /** v1.4 — participant user ids; the whole current member list means the
   *  same as before partial splits existed. */
  split_among: string[];
}

export function useAddExpense(groupId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: AddExpenseInput): Promise<Expense> => {
      const { data, error } = await supabase
        .from("expenses")
        .insert({ ...input, group_id: groupId, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    onMutate: async (input) => {
      // Stop in-flight refetches from overwriting our optimistic row.
      await queryClient.cancelQueries({ queryKey: expenseKeys.list(groupId) });
      const previous = queryClient.getQueryData<CachedExpense[]>(
        expenseKeys.list(groupId),
      );

      // Temp id marks the row until the server assigns the real uuid.
      const tempId = `optimistic-${Math.random().toString(36).slice(2)}`;
      upsertExpense(queryClient, groupId, {
        id: tempId,
        group_id: groupId,
        description: input.description,
        amount: input.amount,
        paid_by: input.paid_by,
        category: input.category,
        split_among: input.split_among,
        split_type: "equal",
        version: 1,
        created_by: userId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _optimistic: true,
      });
      return { previous, tempId };
    },

    onSuccess: (serverRow, _input, context) => {
      // Reconcile: swap the temp row for the authoritative one.
      replaceExpense(queryClient, groupId, context.tempId, serverRow);
    },

    onError: (_err, _input, context) => {
      // Rollback: the optimistic row vanishes, list returns to what it was.
      if (context?.previous) {
        queryClient.setQueryData(expenseKeys.list(groupId), context.previous);
      }
      useToastStore
        .getState()
        .show("Couldn't add the expense — it has been removed. Try again.");
    },
  });
}

export interface UpdateExpenseInput {
  /** The cached row being edited — carries the id and the version we saw. */
  expense: CachedExpense;
  patch: Pick<
    Expense,
    "description" | "amount" | "paid_by" | "category" | "split_among"
  >;
}

export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expense,
      patch,
    }: UpdateExpenseInput): Promise<Expense> => {
      // Compare-and-set on `version` (strategy note 3): only applies if
      // nobody has written since we read version N; the write bumps to N+1.
      const { data, error } = await supabase
        .from("expenses")
        .update({ ...patch, version: expense.version + 1 })
        .eq("id", expense.id)
        .eq("version", expense.version)
        .select()
        .single();

      // PGRST116 = ".single() matched no rows" — our version guard failed,
      // meaning a concurrent edit (or delete) got there first.
      if (error?.code === "PGRST116") throw new ConflictError();
      if (error) throw error;
      return data;
    },

    onMutate: async ({ expense, patch }) => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.list(groupId) });
      const previous = queryClient.getQueryData<CachedExpense[]>(
        expenseKeys.list(groupId),
      );

      upsertExpense(queryClient, groupId, {
        ...expense,
        ...patch,
        _optimistic: true,
      });
      return { previous };
    },

    onSuccess: (serverRow) => {
      replaceExpense(queryClient, groupId, serverRow.id, serverRow);
    },

    onError: (err, _input, context) => {
      if (err instanceof ConflictError) {
        // LOSING A CONFLICT (PRD 5.4): do NOT restore the snapshot — it's
        // stale by definition (someone else's newer edit may already have
        // been merged in by realtime). Refetch so the user sees the winning
        // version, and tell them their edit didn't apply.
        queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
        useToastStore.getState().show(err.message);
        return;
      }
      // Ordinary failure (network, RLS): plain rollback.
      if (context?.previous) {
        queryClient.setQueryData(expenseKeys.list(groupId), context.previous);
      }
      useToastStore
        .getState()
        .show("Couldn't save your edit — changes were rolled back.");
    },
  });
}

export function useDeleteExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string): Promise<void> => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);
      if (error) throw error;
    },

    onMutate: async (expenseId) => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.list(groupId) });
      const previous = queryClient.getQueryData<CachedExpense[]>(
        expenseKeys.list(groupId),
      );
      removeExpense(queryClient, groupId, expenseId);
      return { previous };
    },

    onError: (_err, _expenseId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(expenseKeys.list(groupId), context.previous);
      }
      useToastStore
        .getState()
        .show("Couldn't delete the expense — it has been restored.");
    },
  });
}

// ── Realtime merge (Phase 4) ─────────────────────────────────────────────
// One channel per open group screen, filtered server-side to that group's
// expenses. Every INSERT/UPDATE/DELETE any member commits lands here within
// ~1s and is merged into the same cache the mutations above maintain — no
// refetch, so remote changes feel as instant as local ones (PRD 6).

/** Merge an incoming INSERT/UPDATE row using version-based last-write-wins. */
function applyIncomingRow(
  queryClient: QueryClient,
  groupId: string,
  incoming: Expense,
) {
  const list = queryClient.getQueryData<CachedExpense[]>(
    expenseKeys.list(groupId),
  );
  const cached = list?.find((e) => e.id === incoming.id);

  // Drop stale/duplicate events: anything at or below the version we already
  // hold is old news — typically the echo of our own already-reconciled
  // write coming back around through the WAL.
  if (cached && !cached._optimistic && cached.version >= incoming.version) {
    return;
  }

  // If `cached` is an optimistic row, someone else's write beat our in-flight
  // one. Server truth wins immediately (this is the "last write wins" half of
  // the strategy); our own mutation is now doomed to fail its version guard,
  // and its ConflictError path shows the toast + refetch (the "notify the
  // loser" half). Both paths converge on the server's state.
  upsertExpense(queryClient, groupId, incoming);
}

/**
 * Subscribe the group's expenses AND settlements to Supabase Realtime for
 * as long as the screen is mounted — one channel, two table bindings. RLS
 * applies to the subscription too: members only ever receive their own
 * groups' rows.
 *
 * Settlements are simpler to merge than expenses: they're immutable (no
 * UPDATE events, no version check) — INSERT upserts (idempotent against our
 * own echo), DELETE removes.
 */
export function useGroupRealtime(groupId: string) {
  const queryClient = useQueryClient();
  // Unique per mounted screen: two instances for the same group (e.g. after
  // scanning the QR of a group you're already viewing → router.replace to
  // the same route) briefly coexist. A shared topic like `group:X` would
  // then make the second subscribe throw "cannot add postgres_changes
  // callbacks ... after subscribe()". The postgres_changes filter below is
  // what scopes rows to the group — the topic name is just a channel label.
  const instanceId = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`group:${groupId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          switch (payload.eventType) {
            case "INSERT":
            case "UPDATE":
              applyIncomingRow(
                queryClient,
                groupId,
                payload.new as Expense,
              );
              break;
            case "DELETE":
              // Needs `replica identity full` (phase4.sql) so the old row
              // carries group_id and passes the filter above.
              removeExpense(
                queryClient,
                groupId,
                (payload.old as { id: string }).id,
              );
              break;
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settlements",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          switch (payload.eventType) {
            case "INSERT":
              upsertRow(
                queryClient,
                settlementKeys.list(groupId),
                payload.new as CachedSettlement,
              );
              break;
            case "DELETE":
              removeRow(
                queryClient,
                settlementKeys.list(groupId),
                (payload.old as { id: string }).id,
              );
              break;
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient, instanceId]);
}

// ── Settlements (v1.2) ───────────────────────────────────────────────────
// Recording a payment gets the same optimistic treatment as expenses:
// instant row with a temp id, reconcile on success, rollback + toast on
// failure. What it deliberately DOESN'T get is versioning — settlements are
// immutable (delete + re-record instead of edit), so there is no concurrent
// -edit conflict to resolve.

export function useSettlements(groupId: string) {
  return useQuery({
    queryKey: settlementKeys.list(groupId),
    queryFn: async (): Promise<CachedSettlement[]> => {
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export interface AddSettlementInput {
  from_user: string;
  to_user: string;
  amount: number;
  /** 'payment' clears debt (settle up); 'loan' creates it (cash handover). */
  kind: SettlementKind;
}

export function useAddSettlement(groupId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: AddSettlementInput): Promise<Settlement> => {
      const { data, error } = await supabase
        .from("settlements")
        .insert({ ...input, group_id: groupId, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: settlementKeys.list(groupId),
      });
      const previous = queryClient.getQueryData<CachedSettlement[]>(
        settlementKeys.list(groupId),
      );

      const tempId = `optimistic-${Math.random().toString(36).slice(2)}`;
      upsertRow(queryClient, settlementKeys.list(groupId), {
        id: tempId,
        group_id: groupId,
        from_user: input.from_user,
        to_user: input.to_user,
        amount: input.amount,
        kind: input.kind,
        created_by: userId ?? null,
        created_at: new Date().toISOString(),
        _optimistic: true,
      });
      return { previous, tempId };
    },

    onSuccess: (serverRow, _input, context) => {
      replaceRow(
        queryClient,
        settlementKeys.list(groupId),
        context.tempId,
        serverRow,
      );
    },

    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          settlementKeys.list(groupId),
          context.previous,
        );
      }
      useToastStore
        .getState()
        .show("Couldn't record the payment — it has been removed. Try again.");
    },
  });
}

export function useDeleteSettlement(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settlementId: string): Promise<void> => {
      const { error } = await supabase
        .from("settlements")
        .delete()
        .eq("id", settlementId);
      if (error) throw error;
    },

    onMutate: async (settlementId) => {
      await queryClient.cancelQueries({
        queryKey: settlementKeys.list(groupId),
      });
      const previous = queryClient.getQueryData<CachedSettlement[]>(
        settlementKeys.list(groupId),
      );
      removeRow(queryClient, settlementKeys.list(groupId), settlementId);
      return { previous };
    },

    onError: (_err, _settlementId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          settlementKeys.list(groupId),
          context.previous,
        );
      }
      useToastStore
        .getState()
        .show("Couldn't delete the payment — it has been restored.");
    },
  });
}
