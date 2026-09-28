import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles } from "@/src/theme";

const LEVELS = [
  { key: "ROOKIE", title: "Rookie", blurb: "Makes obvious mistakes. A gentle warm-up rally." },
  { key: "CLUB", title: "Club", blurb: "Solid positioning and dinks. A real game." },
  { key: "PRO", title: "Pro", blurb: "Anticipates, places and picks smart shots." },
] as const;

export default function DifficultySelect() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root} testID="difficulty-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.heading}>Choose difficulty</Text>
        <Text style={styles.sub}>You and your partner face two rivals at this level.</Text>

        <View style={{ marginTop: 20, gap: 14 }}>
          {LEVELS.map((l) => (
            <Pressable
              key={l.key}
              testID={`difficulty-${l.key.toLowerCase()}`}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: "/match", params: { difficulty: l.key } })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.cardBlurb}>{l.blurb}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  back: { color: c.brandPrimary, fontSize: 16, fontWeight: "600", marginBottom: 12 },
  heading: { color: c.onSurface, fontSize: 30, fontWeight: "800" },
  sub: { color: c.muted, fontSize: 15, marginTop: 6 },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: c.onSurfaceSecondary, fontSize: 22, fontWeight: "800" },
  chevron: { color: c.brandPrimary, fontSize: 26, fontWeight: "700" },
  cardBlurb: { color: c.onSurfaceTertiary, fontSize: 14, marginTop: 6, lineHeight: 20 },
}));
