import { Stack } from "expo-router";

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      {/* The summary block owns the top of the list screen (design-ref 01). */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="create"
        options={{ title: "New group", presentation: "modal" }}
      />
      <Stack.Screen
        name="join"
        options={{ title: "Enter invite code", presentation: "modal" }}
      />
      <Stack.Screen
        name="scan"
        options={{ title: "Join a group", presentation: "modal" }}
      />
      <Stack.Screen
        name="[groupId]/add-expense"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="[groupId]/settle"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="[groupId]/loan"
        options={{ presentation: "modal" }}
      />
      {/* [groupId] screens set their own titles once the group loads */}
    </Stack>
  );
}
