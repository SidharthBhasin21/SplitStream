import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "./supabase";
import type { Group, Profile } from "./types";

/**
 * Server-state layer for groups (Phase 2). All group reads rely on RLS to
 * scope rows to the current user; create/join go through Postgres RPCs
 * because they need privileges plain inserts can't have — see the design
 * notes at the top of supabase/phase2.sql.
 */

/** Group row + member count, as returned by the list query below. */
export type GroupListItem = Group & { group_members: { count: number }[] };

export interface MemberWithProfile {
  user_id: string;
  joined_at: string;
  profiles: Pick<Profile, "id" | "name">;
}

export const groupKeys = {
  list: ["groups"] as const,
  detail: (groupId: string) => ["group", groupId] as const,
  members: (groupId: string) => ["members", groupId] as const,
};

export function useGroups() {
  return useQuery({
    queryKey: groupKeys.list,
    queryFn: async (): Promise<GroupListItem[]> => {
      // No user filter needed: RLS only returns groups I'm a member of.
      const { data, error } = await supabase
        .from("groups")
        .select("*, group_members(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: async (): Promise<Group> => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: groupKeys.members(groupId),
    queryFn: async (): Promise<MemberWithProfile[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, joined_at, profiles(id, name)")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      // supabase-js can't statically tell a to-one join from to-many,
      // so it types `profiles` loosely; the FK guarantees a single row.
      return data as unknown as MemberWithProfile[];
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    // Fail fast when offline instead of pausing: the create/join modals
    // await their result, and (unlike expenses) there's no optimistic row
    // to show while a paused mutation waits for reconnection.
    networkMode: "always",
    mutationFn: async (name: string): Promise<Group> => {
      const { data, error } = await supabase.rpc("create_group", {
        group_name: name,
      });
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    // Same fail-fast rationale as useCreateGroup.
    networkMode: "always",
    mutationFn: async (code: string): Promise<Group> => {
      const { data, error } = await supabase.rpc("join_group", { code });
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list });
    },
  });
}
