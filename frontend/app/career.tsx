import React from "react";
import { Text } from "react-native";

import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions } from "@/src/ui/HeaderActions";
import { Card, ScreenTitle, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

export default function Career() {
  const { save } = useSave();
  return (
    <DestinationScreen active="career" bg={require("@/assets/images/bg_career_mumbai.webp")} testID="career-screen" header={<><ScreenTitle title="Career" /><HeaderActions save={save} /></>}>
      <Card><Text style={{ color: UI.ink }}>Career</Text></Card>
    </DestinationScreen>
  );
}
