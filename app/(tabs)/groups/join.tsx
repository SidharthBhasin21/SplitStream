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
  // Prefilled when arriving via an invite deep link (splitstream://groups/join?code=X).
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
    <View className="flex-1 bg-gray-50 px-6 pt-8">
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
        <Text className="mb-3 text-center text-sm text-red-500">
          {serverError}
        </Text>
      ) : null}

      <Pressable
        className="mt-2 items-center rounded-xl bg-teal-600 py-3.5 active:bg-teal-700 disabled:opacity-60"
        onPress={handleSubmit(onSubmit)}
        disabled={joinGroup.isPending}
      >
        {joinGroup.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-white">Join group</Text>
        )}
      </Pressable>

      <Link href="/groups/scan" replace asChild>
        <Pressable className="mt-3 items-center rounded-xl border border-teal-600 bg-white py-3.5 active:bg-teal-50">
          <Text className="text-base font-semibold text-teal-600">
            Scan invite QR instead
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
