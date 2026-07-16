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
          <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </Text>
          <TextInput
            className={`rounded-xl border bg-white px-4 py-3 text-base text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${
              error
                ? "border-red-400"
                : "border-gray-300 dark:border-gray-700"
            }`}
            placeholderTextColor="#9ca3af"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value ?? ""}
            {...inputProps}
          />
          {error ? (
            <Text className="mt-1 text-xs text-red-500">{error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
