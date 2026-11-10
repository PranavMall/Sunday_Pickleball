// /cabinet is now Records → Trophies.
import { Redirect } from "expo-router";
import React from "react";

export default function Cabinet() {
  return <Redirect href={{ pathname: "/records", params: { tab: "trophies" } }} />;
}
