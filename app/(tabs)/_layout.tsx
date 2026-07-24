import { Tabs } from "expo-router";

import { TabBar } from "@/components/ui/TabBar";

export default function TabLayout() {
  return (
    <Tabs
      // Custom floating tab bar (components/ui/TabBar) — renders the tab
      // destinations plus Create/Join actions. Screens add bottom padding so
      // content clears the floating bar.
      tabBar={(props) => (
        <TabBar {...(props as Parameters<typeof TabBar>[0])} />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="groups" options={{ title: "Groups" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
