// DAILY CHALLENGE screen: back button (no title row), THIS WEEK strip, TODAY
// card (court, twist, pair row, reward row, PLAY), tomorrow's twist.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QUICK_PLAY_COURT, PLAYER_BADGE_COLOR } from "@/src/game/meta/economyConfig";
import { DAILY_CODE, DAILY_COLOR, DAILY_REWARD_COINS, DAILY_TEAM, dailyRivalMatch, tierName, timeLeftText, twistFor, weekStrip, wonToday } from "@/src/game/meta/daily";
import { gameEvents } from "@/src/game/meta/events";
import { dayKeyOf } from "@/src/game/meta/metaStore";
import { partnerOf } from "@/src/game/meta/matchSetup";
import { CourtThumb } from "@/src/ui/CourtThumb";
import { Badge, Card, Coin, GoldButton, IconSquare, Kicker, SERIF, UI } from "@/src/ui/kit";
import { Text } from "@/src/ui/Text";
import { useSave } from "@/src/ui/useSave";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function Daily() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { save, identity } = useSave();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const today = dayKeyOf(now);
  const tw = twistFor(today);
  const tomorrow = twistFor(dayKeyOf(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate() + 1, 12).getTime()));
  useEffect(() => {
    gameEvents.dailyView(tw.name);
  }, [tw.name]);
  const m = dailyRivalMatch(save?.career.cleared ?? []);
  const partner = partnerOf(save?.activePartnerId);
  const won = wonToday(save, now);
  const week = weekStrip(now, save?.dailyChallenge.wins ?? []);
  const d = new Date(now);
  const play = () => {
    gameEvents.dailyStart(tw.name);
    router.push({ pathname: "/match", params: { mode: "daily", day: today } });
  };

  return (
    <View style={{ flex: 1 }} testID="daily-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        <IconSquare testID="back-button" icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <Card testID="daily-week">
          <Kicker>THIS WEEK</Kicker>
          <View style={styles.week}>
            {week.map((x) => (
              <View key={x.key} style={styles.dayCol} testID={`daily-day-${x.label.toLowerCase()}-${x.state}`}>
                <Text style={[styles.dayLabel, x.state === "today" && { color: UI.ink }]}>{x.label}</Text>
                <View style={[styles.circle, x.state === "won" && styles.cWon, x.state === "missed" && styles.cMissed, x.state === "today" && styles.cToday, x.state === "future" && styles.cFuture]}>
                  {x.state === "won" ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Text style={[styles.cText, x.state === "future" && { color: UI.muted }]}>{x.state === "missed" ? "–" : String(x.date)}</Text>}
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card testID="daily-today" style={{ gap: 10 }}>
          <View style={styles.head}>
            <Kicker>TODAY · {DAYS[d.getDay()]} {d.getDate()} {MONTHS[d.getMonth()]}</Kicker>
            <View style={styles.left}>
              <Ionicons name="time-outline" size={14} color={UI.ink} />
              <Text style={styles.leftText} testID="daily-time-left">{timeLeftText(now)}</Text>
            </View>
          </View>
          <View style={styles.twistRow}>
            <CourtThumb court={m.court ?? QUICK_PLAY_COURT} width={Math.min(96, width * 0.24)} testID="daily-court" />
            <View style={{ flex: 1 }}>
              <Text style={styles.twistName} testID="daily-twist-name">{tw.name}</Text>
              <Text style={styles.twistLine}>{tw.line}</Text>
            </View>
          </View>
          <View style={styles.inner}>
            <View style={styles.pair}>
              <Badge name={identity?.playerName || "P"} color={PLAYER_BADGE_COLOR} size={30} />
              {!tw.singles ? (
                <View style={{ marginLeft: -8 }}>
                  <Badge id={partner.id} name={partner.name} color={partner.color} size={30} />
                </View>
              ) : null}
            </View>
            <Text style={styles.vs}>vs</Text>
            <Badge name={DAILY_CODE} color={DAILY_COLOR} size={30} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.rival} numberOfLines={1}>{DAILY_TEAM} · {tierName(m)}</Text>
              <Text style={styles.sub} numberOfLines={1}>your next Career level · {tw.short.toLowerCase()}</Text>
            </View>
          </View>
          <View style={[styles.inner, { alignItems: "flex-start" }]} testID="daily-reward">
            <Coin size={24} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              {won ? (
                <Text style={styles.rewardMain} testID="daily-reward-done">Won today ✓ · come back tomorrow</Text>
              ) : (
                <>
                  <Text style={styles.rewardMain}>
                    <Text style={{ fontWeight: "900" }}>+{DAILY_REWARD_COINS} Coins</Text> for your first win today
                  </Text>
                  <Text style={styles.sub}>Unlimited retries · doesn't use your Quick Play matches</Text>
                </>
              )}
            </View>
          </View>
          <GoldButton big testID="daily-play" label="PLAY" onPress={play} style={{ minHeight: 56 }} />
        </Card>
        <View style={styles.tomorrow} testID="daily-tomorrow">
          <Text style={styles.tomorrowText}>
            Tomorrow: <Text style={{ fontWeight: "900" }}>{tomorrow.name}</Text> · {tomorrow.short.toLowerCase()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  dayCol: { alignItems: "center", gap: 4, flex: 1 },
  dayLabel: { color: UI.muted, fontSize: 10, fontWeight: "800" },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  cWon: { backgroundColor: UI.green },
  cMissed: { backgroundColor: UI.creamDeep },
  cToday: { backgroundColor: UI.gold, borderWidth: 2, borderColor: UI.goldDeep },
  cFuture: { borderWidth: 1.5, borderStyle: "dashed", borderColor: UI.muted },
  cText: { color: UI.ink, fontSize: 13, fontWeight: "900" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 4 },
  leftText: { color: UI.ink, fontSize: 12, fontWeight: "800" },
  twistRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  twistName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 26 },
  twistLine: { color: UI.inkSoft, fontSize: 14, lineHeight: 19 },
  inner: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 14, padding: 10 },
  pair: { flexDirection: "row" },
  vs: { color: UI.muted, fontSize: 12, marginHorizontal: 8, fontWeight: "700" },
  rival: { color: UI.ink, fontSize: 14, fontWeight: "800" },
  sub: { color: UI.inkSoft, fontSize: 11.5, marginTop: 1 },
  rewardMain: { color: UI.ink, fontSize: 14, fontWeight: "600" },
  tomorrow: { alignSelf: "center", backgroundColor: "rgba(251,244,226,0.9)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  tomorrowText: { color: UI.ink, fontSize: 13 },
});
