import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Text, TextInput, View, type TextInputProps } from "react-native";

interface FormInputProps<T extends FieldValues> extends TextInputProps {
  control: Control<T>;
  name: Path<T>;
  label: string;
}

/**
 * A labelled TextInput wired to React Hook Form via <Controller>,
 * showing the field's Zod validation error underneath.
 */
export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  ...inputProps
}: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className="mb-4">
          <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}
          </Text>
          <TextInput
            // Both branches carry a dark: border class on purpose: the error
            // border toggles on a MOUNTED input (remount would drop focus),
            // and NativeWind crashes if a live component's classes change
            // which style features they use (css-interop upgrade limitation).
            className={`rounded-2xl border bg-white px-4 py-3.5 text-base text-ink dark:bg-gray-900 dark:text-gray-100 ${
              error
                ? "border-rust dark:border-rust"
                : "border-gray-200 dark:border-gray-800"
            }`}
            placeholderTextColor="#9ca3af"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value ?? ""}
            {...inputProps}
          />
          {error ? (
            <Text className="mt-1 text-xs text-rust">{error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
