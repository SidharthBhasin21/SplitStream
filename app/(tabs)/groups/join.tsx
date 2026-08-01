import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { z } from "zod";

import { FormInput } from "@/components/FormInput";
import { useJoinGroup } from "@/lib/groups";

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .length(6, "Invite codes are 6 characters"),
});

type JoinForm = z.infer<typeof joinSchema>;

export default function JoinGroupScreen() {
  const router = useRouter();
  const joinGroup = useJoinGroup();
  // Prefilled when arriving via an invite deep link (lumenz://groups/join?code=X).
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: linkedCode?.toUpperCase() ?? "" },
  });

  const onSubmit = async ({ code }: JoinForm) => {
    setServerError(null);
    try {
      const group = await joinGroup.mutateAsync(code);
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <View className="flex-1 bg-paper px-6 pt-8 dark:bg-gray-950">
      <FormInput
        control={control}
        name="code"
        label="Invite code"
        placeholder="ABC123"
        autoFocus
        autoCapitalize="characters"
        maxLength={6}
      />

      {serverError ? (
        <Text className="mb-3 text-center text-sm text-rust">
          {serverError}
        </Text>
      ) : null}

      <Pressable
        className="mt-2 items-center rounded-full bg-ink py-4 active:opacity-80 disabled:opacity-60 dark:bg-white"
        onPress={handleSubmit(onSubmit)}
        disabled={joinGroup.isPending}
      >
        {joinGroup.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-white dark:text-ink">Join group</Text>
        )}
      </Pressable>

      <Link href="/groups/scan" replace asChild>
        <Pressable className="mt-3 items-center rounded-full border border-ink/20 py-4 active:bg-gray-100 dark:border-gray-600 dark:active:bg-gray-800">
          <Text className="text-base font-semibold text-ink dark:text-gray-100">
            Scan invite QR instead
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
