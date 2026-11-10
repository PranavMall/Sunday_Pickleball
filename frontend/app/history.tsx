// /history is now Records → History.
import { Redirect } from "expo-router";
import React from "react";

export default function History() {
  return <Redirect href={{ pathname: "/records", params: { tab: "history" } }} />;
}
