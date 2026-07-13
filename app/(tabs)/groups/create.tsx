import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { z } from "zod";

import { FormInput } from "@/components/FormInput";
import { useCreateGroup } from "@/lib/groups";

const createSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters"),
});

type CreateForm = z.infer<typeof createSchema>;

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroup = useCreateGroup();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = async ({ name }: CreateForm) => {
    setServerError(null);
    try {
      const group = await createGroup.mutateAsync(name);
      // Replace the modal with the new group's detail screen.
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-8">
      <FormInput
        control={control}
        name="name"
        label="Group name"
        placeholder="Goa Trip"
        autoFocus
      />

      {serverError ? (
        <Text className="mb-3 text-center text-sm text-red-500">
          {serverError}
        </Text>
      ) : null}

      <Pressable
        className="mt-2 items-center rounded-xl bg-teal-600 py-3.5 active:bg-teal-700 disabled:opacity-60"
        onPress={handleSubmit(onSubmit)}
        disabled={createGroup.isPending}
      >
        {createGroup.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-white">
            Create group
          </Text>
        )}
      </Pressable>
    </View>
  );
}
