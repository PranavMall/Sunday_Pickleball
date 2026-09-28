import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

export default function MainMenu() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root} testID="main-menu-screen">
      <Image
        source={require("@/assets/images/court_background.png")}
        style={styles.bg}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(251,246,233,0.15)", "rgba(46,61,42,0.55)"]}
        style={styles.overlay}
      />
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.titleWrap}>
          <Text style={styles.kicker}>GARDEN COURT DOUBLES</Text>
          <Text style={styles.title}>Picklewood</Text>
          <Text style={styles.subtitle}>Swipe to play. Master the kitchen.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="play-button"
            style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
            onPress={() => router.push("/difficulty")}
          >
            <Text style={styles.playText}>PLAY</Text>
          </Pressable>
          <Text style={styles.footer}>2v2 · You + partner vs two rivals</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: 28 },
  titleWrap: { alignItems: "flex-start", marginTop: 24 },
  kicker: { color: c.accentGold, fontSize: 13, fontWeight: "700", letterSpacing: 3, marginBottom: 8 },
  title: { color: c.onSurfaceInverse, fontSize: 56, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: c.onSurfaceInverse, opacity: 0.85, fontSize: 16, marginTop: 8 },
  actions: { alignItems: "center" },
  playBtn: {
    backgroundColor: c.brandPrimary,
    paddingVertical: 18,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  playText: { color: c.onBrandPrimary, fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  footer: { color: c.onSurfaceInverse, opacity: 0.7, fontSize: 13, marginTop: 16 },
}));
