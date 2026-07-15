import { Stack } from "expo-router";

export default function GroupsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Groups" }} />
      <Stack.Screen
        name="create"
        options={{ title: "New group", presentation: "modal" }}
      />
      <Stack.Screen
        name="join"
        options={{ title: "Join group", presentation: "modal" }}
      />
      <Stack.Screen
        name="[groupId]/add-expense"
        options={{ presentation: "modal" }}
      />
      {/* [groupId] screens set their own titles once the group loads */}
    </Stack>
  );
}
