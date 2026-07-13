import { Link } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { useGroups, type GroupListItem } from "@/lib/groups";

function GroupCard({ group }: { group: GroupListItem }) {
  const memberCount = group.group_members[0]?.count ?? 0;
  return (
    <Link href={`/groups/${group.id}`} asChild>
      <Pressable className="mb-3 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-100">
        <Text className="text-lg font-semibold text-gray-900">
          {group.name}
        </Text>
        <Text className="mt-1 text-sm text-gray-500">
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function GroupsScreen() {
  const { data: groups, isPending, error, refetch, isRefetching } = useGroups();

  return (
    <View className="flex-1 bg-gray-50 px-4 pt-4">
      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-center text-base text-red-500">
            Couldn't load your groups.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-teal-600">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GroupCard group={item} />}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View className="items-center px-8 pt-24">
              <Text className="mb-2 text-center text-xl font-semibold text-gray-900">
                No groups yet
              </Text>
              <Text className="text-center text-base text-gray-500">
                Create a group for your trip or flat, or join one with an
                invite code.
              </Text>
            </View>
          }
        />
      )}

      <View className="flex-row gap-3 pb-6 pt-2">
        <Link href="/groups/join" asChild>
          <Pressable className="flex-1 items-center rounded-xl border border-teal-600 bg-white py-3.5 active:bg-teal-50">
            <Text className="text-base font-semibold text-teal-600">
              Join with code
            </Text>
          </Pressable>
        </Link>
        <Link href="/groups/create" asChild>
          <Pressable className="flex-1 items-center rounded-xl bg-teal-600 py-3.5 active:bg-teal-700">
            <Text className="text-base font-semibold text-white">
              Create group
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
