import React from "react";
import { Text } from "react-native";

import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions } from "@/src/ui/HeaderActions";
import { Card, ScreenTitle, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

export default function Training() {
  const { save } = useSave();
  return (
    <DestinationScreen active="training" bg={require("@/assets/images/bg_home.webp")} dim testID="training-screen" header={<><ScreenTitle title="Training" /><HeaderActions save={save} /></>}>
      <Card><Text style={{ color: UI.ink }}>Training</Text></Card>
    </DestinationScreen>
  );
}
