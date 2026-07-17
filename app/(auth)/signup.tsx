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

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const [serverError, setServerError] = useState<string | null>(null);
  // Shown when the Supabase project has email confirmation enabled:
  // signUp succeeds but returns no session until the user clicks the link.
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async ({ name, email, password }: SignupForm) => {
    setServerError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // `name` lands in auth metadata; a DB trigger copies it into
      // public.profiles (see supabase/phase1.sql).
      options: { data: { name } },
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    if (!data.session) {
      setConfirmationSent(true);
    }
    // With email confirmation disabled, a session comes back immediately and
    // the root layout's route guard switches to (tabs).
  };

  if (confirmationSent) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-8 dark:bg-gray-950">
        <Text className="mb-2 text-center text-2xl font-bold text-ink dark:text-gray-100">
          Check your inbox
        </Text>
        <Text className="mb-8 text-center text-base text-gray-500 dark:text-gray-400">
          We sent you a confirmation link. Tap it, then come back and log in.
        </Text>
        <Link href="/login" className="font-semibold text-ledger">
          Back to log in
        </Link>
      </View>
    );
  }

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
          Create account
        </Text>
        <Text className="mb-10 text-center text-base text-gray-500 dark:text-gray-400">
          Track shared expenses with your group
        </Text>

        <FormInput
          control={control}
          name="name"
          label="Name"
          placeholder="Your name"
          autoComplete="name"
        />
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
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete="new-password"
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
            <Text className="text-base font-semibold text-white dark:text-ink">Sign up</Text>
          )}
        </Pressable>

        <GoogleSignIn onError={setServerError} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500 dark:text-gray-400">Already have an account? </Text>
          <Link href="/login" className="font-semibold text-ledger">
            Log in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
