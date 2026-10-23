import { QueryClientProvider } from "@tanstack/react-query";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { initMeta } from "@/src/game/meta";
import { queryClient } from "@/src/query-client";
import { DestinationBackdrop } from "@/src/ui/DestinationBackdrop";

// Destinations switch by replace with no native animation; the backdrop
// cross-fades and the content fades in (150 ms) instead.
// Navigator theme with a transparent background so the backdrop shows through
// destination screens (match / profile / history paint their own).
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "transparent" } };
const DEST = { animation: "none" as const, contentStyle: { backgroundColor: "transparent" } };

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
            {/* One persistent destination background behind the Stack;
                destination screens are transparent and draw none. */}
            <DestinationBackdrop />
            <ThemeProvider value={NAV_THEME}>
            <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
              <Stack.Screen name="index" options={DEST} />
              <Stack.Screen name="career" options={DEST} />
              <Stack.Screen name="team" options={DEST} />
              <Stack.Screen name="training" options={DEST} />
              <Stack.Screen name="quickplay" options={{ contentStyle: { backgroundColor: "transparent" } }} />
            </Stack>
            </ThemeProvider>
          </GestureHandlerRootView>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
