import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { z } from "zod";

import { FormInput } from "@/components/FormInput";
import { GoogleSignIn } from "@/components/ui/GoogleButton";
import { supabase } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }: LoginForm) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setServerError(error.message);
    }
    // On success the auth listener updates the store and the root layout's
    // route guard switches to (tabs) — no manual navigation needed.
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper dark:bg-gray-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-1 text-center text-3xl font-bold text-ledger">
          SplitStream
        </Text>
        <Text className="mb-10 text-center text-base text-gray-500 dark:text-gray-400">
          Split expenses, in real time
        </Text>

        <FormInput
          control={control}
          name="email"
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <FormInput
          control={control}
          name="password"
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
        />

        {serverError ? (
          <Text className="mb-3 text-center text-sm text-rust">
            {serverError}
          </Text>
        ) : null}

        <Pressable
          className="mt-2 items-center rounded-full bg-ink py-4 active:opacity-80 disabled:opacity-60 dark:bg-white"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white dark:text-ink">Log in</Text>
          )}
        </Pressable>

        <GoogleSignIn onError={setServerError} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500 dark:text-gray-400">Don't have an account? </Text>
          <Link href="/signup" className="font-semibold text-ledger">
            Sign up
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
