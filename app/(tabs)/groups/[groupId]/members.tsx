import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";

import { useGroup, useGroupMembers, type MemberWithProfile } from "@/lib/groups";

function MemberRow({ member }: { member: MemberWithProfile }) {
  const initials = member.profiles.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View className="mb-2 flex-row items-center rounded-xl bg-white p-3">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-teal-600">
        <Text className="text-sm font-bold text-white">{initials}</Text>
      </View>
      <Text className="text-base font-medium text-gray-900">
        {member.profiles.name}
      </Text>
    </View>
  );
}

export default function MembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: group } = useGroup(groupId);
  const { data: members, isPending, error, refetch } = useGroupMembers(groupId);

  const shareInvite = () => {
    if (!group) return;
    Share.share({
      message: `Join "${group.name}" on SplitStream with invite code: ${group.invite_code}`,
    });
  };

  return (
    <View className="flex-1 bg-gray-50 px-4 pt-4">
      <Stack.Screen options={{ title: "Members" }} />

      <View className="mb-4 items-center rounded-2xl border border-dashed border-teal-400 bg-teal-50 p-4">
        <Text className="mb-1 text-sm text-gray-600">Invite code</Text>
        <Text className="mb-3 text-3xl font-bold tracking-widest text-teal-700">
          {group?.invite_code ?? "······"}
        </Text>
        <Pressable
          className="rounded-lg bg-teal-600 px-4 py-2 active:bg-teal-700"
          onPress={shareInvite}
        >
          <Text className="text-sm font-semibold text-white">Share code</Text>
        </Pressable>
      </View>

      {error ? (
        <View className="mt-8 items-center">
          <Text className="mb-2 text-center text-base text-red-500">
            Couldn't load members.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-teal-600">Try again</Text>
          </Pressable>
        </View>
      ) : isPending ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          renderItem={({ item }) => <MemberRow member={item} />}
        />
      )}
    </View>
  );
}
