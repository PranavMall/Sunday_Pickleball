import React from "react";
import { Text } from "react-native";

import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions } from "@/src/ui/HeaderActions";
import { Card, ScreenTitle, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

export default function Team() {
  const { save } = useSave();
  return (
    <DestinationScreen active="team" bg={require("@/assets/images/bg_career_mumbai.webp")} testID="team-screen" header={<><ScreenTitle title="Team" /><HeaderActions save={save} /></>}>
      <Card><Text style={{ color: UI.ink }}>Team</Text></Card>
    </DestinationScreen>
  );
}
