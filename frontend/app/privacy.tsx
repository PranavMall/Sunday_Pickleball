// PRIVACY POLICY: back button (no title row) + the policy as native text
// (bold headings, bullets), scrollable, offline.
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PRIVACY_TEXT } from "@/src/game/meta/privacy";
import { Card, IconSquare, SERIF, UI } from "@/src/ui/kit";
import { Text } from "@/src/ui/Text";

// "**bold** rest *italic* rest" → nested Text runs.
function Inline({ text, style }: { text: string; style: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <Text key={i} style={styles.bold}>{p.slice(2, -2)}</Text>
        ) : p.startsWith("*") ? (
          <Text key={i} style={styles.em}>{p.slice(1, -1)}</Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lines = PRIVACY_TEXT.split("\n").filter((l) => l.trim().length);
  return (
    <View style={styles.root} testID="privacy-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 10 }}>
        <IconSquare testID="back-button" icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <Card style={{ gap: 8 }}>
          {lines.map((l, i) => {
            const head = /^\*\*[^*]+\*\*$/.test(l.trim());
            if (i === 0) return <Text key={i} style={styles.title}>{l.replace(/\*\*/g, "")}</Text>;
            if (head) return <Text key={i} style={styles.head}>{l.replace(/\*\*/g, "")}</Text>;
            if (l.startsWith("- "))
              return (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.body}>•</Text>
                  <Inline text={l.slice(2)} style={[styles.body, { flex: 1 }]} />
                </View>
              );
            return <Inline key={i} text={l} style={styles.body} />;
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EFE6CF" },
  title: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24 },
  head: { color: UI.ink, fontSize: 16, fontWeight: "900", marginTop: 8 },
  body: { color: UI.inkSoft, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: "800", color: UI.ink },
  em: { fontStyle: "italic", fontWeight: "700", color: UI.ink },
  bulletRow: { flexDirection: "row", gap: 8 },
});
