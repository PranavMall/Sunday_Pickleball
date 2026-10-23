import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { initMeta } from "@/src/game/meta";
import { queryClient } from "@/src/query-client";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);
// APP START: load (or create) the one progression save.
initMeta();

export default function RootLayout() {
  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {/* Destinations switch instantly (replace, no cross-fade) so only
                one full-screen background is ever mounted. */}
            <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
              <Stack.Screen name="index" options={{ animation: "none" }} />
              <Stack.Screen name="career" options={{ animation: "none" }} />
              <Stack.Screen name="team" options={{ animation: "none" }} />
              <Stack.Screen name="training" options={{ animation: "none" }} />
            </Stack>
          </GestureHandlerRootView>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
