import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { z } from "zod";

import { FormInput } from "@/components/FormInput";
import { CURRENCIES } from "@/lib/currency";
import { useCurrencyStore } from "@/lib/currencyStore";
import { useCreateGroup } from "@/lib/groups";

const createSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters"),
});

type CreateForm = z.infer<typeof createSchema>;

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroup = useCreateGroup();
  const [serverError, setServerError] = useState<string | null>(null);
  // Pre-select the user's home currency (Profile) — the common case is a
  // group in your own currency; trip groups are the exception you switch for.
  const homeCurrency = useCurrencyStore((s) => s.homeCurrency);
  const [currency, setCurrency] = useState(homeCurrency);

  const { control, handleSubmit } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = async ({ name }: CreateForm) => {
    setServerError(null);
    try {
      const group = await createGroup.mutateAsync({ name, currency });
      // Replace the modal with the new group's detail screen.
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <View className="flex-1 bg-paper px-6 pt-8 dark:bg-gray-950">
      <FormInput
        control={control}
        name="name"
        label="Group name"
        placeholder="Goa Trip"
        autoFocus
      />

      <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        Currency
      </Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {CURRENCIES.map((c) => {
          const selected = currency === c.code;
          return (
            <Pressable
              // Remount on selection flip — NativeWind can't upgrade a
              // mounted component's style features (see SegmentedControl).
              key={`${c.code}-${selected}`}
              className={`flex-row items-center rounded-full border px-3 py-2 ${
                selected
                  ? "border-ledger bg-ledger"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              }`}
              onPress={() => setCurrency(c.code)}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected ? "text-white" : "text-ink dark:text-gray-100"
                }`}
              >
                {c.symbol}
              </Text>
              <Text
                className={`ml-1.5 text-sm ${
                  selected
                    ? "font-semibold text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {c.code}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="mb-4 text-sm text-gray-400 dark:text-gray-500">
        All expenses in this group will be tracked in {currency}. This can't
        be changed later.
      </Text>

      {serverError ? (
        <Text className="mb-3 text-center text-sm text-rust">
          {serverError}
        </Text>
      ) : null}

      <Pressable
        className="mt-2 items-center rounded-full bg-ink py-4 active:opacity-80 disabled:opacity-60 dark:bg-white"
        onPress={handleSubmit(onSubmit)}
        disabled={createGroup.isPending}
      >
        {createGroup.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-white dark:text-ink">
            Create group
          </Text>
        )}
      </Pressable>
    </View>
  );
}
