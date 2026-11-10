// Match History (Records → History tab): the saved match log, newest first.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { getMatchResults, type MatchResultRecord } from "@/src/game/services/matchLog";
import { Text } from "./Text";
import { Card, UI } from "./kit";

function formatDate(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

export function HistoryBody() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MatchResultRecord[]>([]);

  useEffect(() => {
    getMatchResults().then((list) => {
      setRecords([...list].reverse());
      setLoading(false);
    });
  }, []);

  const played = records.length;
  const wins = records.filter((r) => r.winner === "near").length;
  const winPct = played ? Math.round((wins / played) * 100) : 0;
  const longestEver = records.reduce((m, r) => Math.max(m, r.rallyStats?.longestRally ?? 0), 0);

  return (
    <View style={{ gap: 10 }} testID="history-screen">
      <Card style={styles.statsRow}>
        <Stat label="Played" value={String(played)} />
        <Stat label="Wins" value={String(wins)} />
        <Stat label="Win %" value={`${winPct}%`} />
        <Stat label="Longest rally" value={String(longestEver)} />
      </Card>
      {loading ? (
        <ActivityIndicator color={UI.wood} style={{ marginTop: 30 }} />
      ) : played === 0 ? (
        <Card style={styles.empty} testID="history-empty">
          <Text style={styles.emptyEmoji}>🥒</Text>
          <Text style={styles.emptyText}>No matches yet — play your first match.</Text>
        </Card>
      ) : (
        records.map((r, i) => {
          const won = r.winner === "near";
          return (
            <Card key={`${r.timestamp}-${i}`} style={styles.rowCard} testID="history-row">
              <View style={styles.rowTop}>
                <Text style={styles.rowDate}>{formatDate(r.timestamp)}</Text>
                <View style={[styles.pill, { backgroundColor: won ? UI.green : UI.creamDeep }]}>
                  <Text style={[styles.pillText, { color: won ? "#fff" : UI.inkSoft }]}>{won ? "WIN" : "LOSS"}</Text>
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
            </Card>
          );
        })
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", padding: 10, gap: 6 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: UI.ink, fontSize: 20, fontWeight: "800" },
  statLabel: { color: UI.muted, fontSize: 11, marginTop: 2, fontWeight: "600", textAlign: "center" },
  empty: { alignItems: "center", padding: 20 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: UI.inkSoft, fontSize: 15, textAlign: "center", fontWeight: "600" },
  rowCard: { padding: 12 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowDate: { color: UI.muted, fontSize: 12, fontWeight: "600" },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  rowMid: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 6 },
  rowScore: { color: UI.ink, fontSize: 22, fontWeight: "800" },
  rowMeta: { color: UI.inkSoft, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  rowSub: { color: UI.muted, fontSize: 12, marginTop: 4 },
});
