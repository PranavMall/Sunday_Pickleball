import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMatchResults, type MatchResultRecord } from "@/src/game/services/matchLog";
import { makeStyles, useTheme } from "@/src/theme";

function formatDate(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function opponentLabel(rec: MatchResultRecord): string {
  const far = Array.isArray(rec.teams?.far) ? rec.teams.far : [];
  const first = far[0];
  const diff = first?.profileId || first?.personality || first?.name;
  return diff ? String(diff) : "Rivals";
}

export default function History() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MatchResultRecord[]>([]);

  useEffect(() => {
    getMatchResults().then((list) => {
      // Newest first. Guard already applied in getMatchResults.
      setRecords([...list].reverse());
      setLoading(false);
    });
  }, []);

  const played = records.length;
  const wins = records.filter((r) => r.winner === "near").length;
  const winPct = played ? Math.round((wins / played) * 100) : 0;
  const longestEver = records.reduce((m, r) => Math.max(m, r.rallyStats?.longestRally ?? 0), 0);

  return (
    <View style={styles.root} testID="history-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.heading}>Match History</Text>

        <View style={styles.statsRow}>
          <Stat label="Played" value={String(played)} />
          <Stat label="Wins" value={String(wins)} />
          <Stat label="Win %" value={`${winPct}%`} />
          <Stat label="Longest rally" value={String(longestEver)} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : played === 0 ? (
          <View style={styles.empty} testID="history-empty">
            <Text style={styles.emptyEmoji}>🥒</Text>
            <Text style={styles.emptyText}>No matches yet — play your first match.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 18, gap: 10 }}>
            {records.map((r, i) => {
              const won = r.winner === "near";
              return (
                <View key={`${r.timestamp}-${i}`} style={styles.rowCard} testID="history-row">
                  <View style={styles.rowTop}>
                    <Text style={styles.rowDate}>{formatDate(r.timestamp)}</Text>
                    <View style={[styles.resultPill, won ? styles.winPill : styles.lossPill]}>
                      <Text style={[styles.resultPillText, won ? styles.winText : styles.lossText]}>{won ? "WIN" : "LOSS"}</Text>
                    </View>
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.rowScore}>
                      {r.finalScore?.near ?? 0} – {r.finalScore?.far ?? 0}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {r.format === "singles" ? "Singles" : "Doubles"} · vs {opponentLabel(r)}
                    </Text>
                  </View>
                  <Text style={styles.rowSub}>Longest rally {r.rallyStats?.longestRally ?? 0}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  back: { color: c.brandPrimary, fontSize: 16, fontWeight: "600", marginBottom: 12 },
  heading: { color: c.onSurface, fontSize: 30, fontWeight: "800", marginBottom: 18 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flex: 1, minWidth: 72, backgroundColor: c.surfaceSecondary, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: c.border },
  statValue: { color: c.brandPrimary, fontSize: 22, fontWeight: "800" },
  statLabel: { color: c.muted, fontSize: 11, marginTop: 3, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { color: c.muted, fontSize: 16, textAlign: "center", fontWeight: "600" },
  rowCard: { backgroundColor: c.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowDate: { color: c.muted, fontSize: 12, fontWeight: "600" },
  resultPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  winPill: { backgroundColor: c.brandTertiary },
  lossPill: { backgroundColor: c.surfaceTertiary },
  resultPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  winText: { color: c.onBrandTertiary },
  lossText: { color: c.onSurfaceTertiary },
  rowMid: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 8 },
  rowScore: { color: c.onSurface, fontSize: 24, fontWeight: "800" },
  rowMeta: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  rowSub: { color: c.muted, fontSize: 12, marginTop: 6 },
}));
