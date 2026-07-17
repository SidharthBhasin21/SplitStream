import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { ListRow } from "@/components/ui/ListRow";
import {
  useGroup,
  useGroupMembers,
  type MemberWithProfile,
} from "@/lib/groups";
import { inviteUrl } from "@/lib/invites";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MemberRow({ member }: { member: MemberWithProfile }) {
  const tint = entityTint(member.user_id);
  const joined = new Date(member.joined_at).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  return (
    <ListRow
      avatar={
        <CircleAvatar
          initials={initials(member.profiles.name)}
          bg={tint.bg}
          fg={tint.fg}
        />
      }
      title={member.profiles.name}
      subtitle={`since ${joined}`}
    />
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
    <View className="flex-1 bg-paper px-5 pt-4 dark:bg-gray-950">
      <Stack.Screen options={{ title: "Members" }} />

      <View className="mb-2 items-center rounded-3xl bg-white p-5 dark:bg-gray-900">
        <Text className="text-sm font-medium text-gray-400">Invite code</Text>
        <Text className="mb-3 mt-1 text-3xl font-bold tracking-widest text-ink dark:text-gray-50">
          {group?.invite_code ?? "······"}
        </Text>
        {group ? (
          <View className="rounded-2xl bg-white p-3">
            {/* Scannable from the join screen's "Scan QR" option */}
            <QRCode value={inviteUrl(group.invite_code)} size={140} />
          </View>
        ) : null}
        <Pressable
          className="mt-4 w-full items-center rounded-full bg-ink py-3 active:opacity-80 dark:bg-white"
          onPress={shareInvite}
        >
          <Text className="text-sm font-semibold text-white dark:text-ink">
            Share code
          </Text>
        </Pressable>
      </View>

      <Text className="mb-1 mt-4 text-lg font-bold text-ink dark:text-gray-100">
        Members
      </Text>

      {error ? (
        <View className="mt-8 items-center">
          <Text className="mb-2 text-center text-base text-rust">
            Couldn't load members.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-ledger">Try again</Text>
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
