import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Platform } from "react-native";

// Immersive full screen for the home + match screens: hides the status bar and,
// on Android, the navigation bar (the system lets the user swipe from the edge
// to reveal it temporarily). Safe-area insets still apply to all controls.
// Behaviour varies by Android navigation mode / device — the native build is
// authoritative; Expo Go and web may ignore parts of it.
export function Fullscreen() {
  return (
    <>
      <StatusBar hidden />
      {Platform.OS === "android" ? <NavigationBar hidden /> : null}
    </>
  );
}
