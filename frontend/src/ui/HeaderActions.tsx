// Header actions shared by every destination: Inbox + Stats icon buttons and
// their overlays (no animation, no server).
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { meta } from "@/src/game/meta";
import { hasUnread, inboxMessages } from "@/src/game/meta/inbox";
import { partnerOf } from "@/src/game/meta/matchSetup";
import { levelView } from "@/src/game/meta/levels";
import type { SaveDoc } from "@/src/game/meta/metaStore";
import { getMatchResults, type MatchResultRecord } from "@/src/game/services/matchLog";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Badge, Card, Coin, IconSquare, MeterRow, SERIF, UI } from "./kit";

export function HeaderActions({ save, onChange }: { save: SaveDoc | null; onChange?: () => void }) {
  const [open, setOpen] = useState<null | "inbox" | "stats">(null);
  const unread = !!save && hasUnread(save);
  return (
    <View style={styles.row}>
      <IconSquare testID="header-inbox" icon="mail" label={unread ? "Inbox, unread messages" : "Inbox"} dot={unread} onPress={() => setOpen("inbox")} />
      <IconSquare testID="header-stats" icon="bar-chart" label="Stats" onPress={() => setOpen("stats")} />
      <Overlay visible={open !== null} title={open === "inbox" ? "Inbox" : "Stats"} onClose={() => setOpen(null)} testID={`${open ?? "none"}-overlay`}>
        {open === "inbox" ? <InboxBody save={save} onChange={onChange} onClose={() => setOpen(null)} /> : null}
        {open === "stats" ? <StatsBody save={save} onClose={() => setOpen(null)} /> : null}
      </Overlay>
    </View>
  );
}

function InboxBody({ save, onChange, onClose }: { save: SaveDoc | null; onChange?: () => void; onClose: () => void }) {
  const router = useRouter();
  const msgs = save ? inboxMessages(save) : [];
  // Snapshot of what was unread when opened; then mark everything read.
  const [unreadIds] = useState(() => msgs.filter((m) => !save?.inboxRead.includes(m.id)).map((m) => m.id));
  useEffect(() => {
    if (unreadIds.length && meta.loaded && meta.markInboxRead(unreadIds)) onChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!msgs.length) return <Text style={styles.empty} testID="inbox-empty">No messages yet. Play Career matches to hear from Mumbai.</Text>;
  return (
    <View>
      {[...msgs].reverse().map((m) => (
        <View key={m.id} style={styles.msgRow} testID={`inbox-${m.id}`}>
          <View>
            <Badge id={m.senderId} name={m.sender} color={m.senderId ? partnerOf(m.senderId).color : UI.wood} size={36} />
            {unreadIds.includes(m.id) ? <View style={styles.unreadDot} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.msgSender}>{m.sender}</Text>
            <Text style={styles.msgText}>{m.subject}</Text>
            <Text style={styles.msgLine}>{m.line}</Text>
          </View>
          <Pressable
            testID={`inbox-cta-${m.id}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={() => {
              onClose();
              router.replace(m.cta.path);
            }}
          >
            <Text style={styles.ctaText} numberOfLines={2}>{m.cta.label}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function StatsBody({ save, onClose }: { save: SaveDoc | null; onClose: () => void }) {
  const router = useRouter();
  const [log, setLog] = useState<MatchResultRecord[] | null>(null);
  useEffect(() => {
    getMatchResults().then(setLog);
  }, []);
  const career = (log ?? []).filter((r) => r.matchType === "career");
  const wins = career.filter((r) => r.winner === "near").length;
  const losses = career.length - wins;
  const rate = career.length ? Math.round((wins / career.length) * 100) : 0;
  const longest = (log ?? []).reduce((m, r) => Math.max(m, r.rallyStats?.longestRally ?? 0), 0);
  const partner = partnerOf(save?.activePartnerId);
  const lv = levelView(save?.partners[partner.id]?.growth ?? 0, save?.career.nextMatchId ?? "mumbai.community.01");
  const chem = Math.floor((save?.chemistryHalves[`player+${partner.id}`] ?? 0) / 2);
  return (
    <View testID="stats-body">
      <View style={styles.grid}>
        <Stat label="Career wins" value={String(wins)} testID="stat-wins" />
        <Stat label="Career losses" value={String(losses)} testID="stat-losses" />
        <Stat label="Win rate" value={`${rate}%`} testID="stat-rate" />
        <Stat label="Longest rally" value={String(longest)} testID="stat-rally" />
        <Stat icon={<Ionicons name="people" size={16} color={UI.fans} />} label="Fans" value={String(save?.fans ?? 0)} testID="stat-fans" />
        <Stat icon={<Coin size={16} />} label="Coins" value={String(save?.coins ?? 0)} testID="stat-coins" />
      </View>
      <View style={styles.partner}>
        <Badge id={partner.id} name={partner.name} color={partner.color} size={40} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <Text style={styles.partnerSub}>Active partner · {partner.archetype}</Text>
        </View>
      </View>
      <MeterRow icon="star" value={lv.frac * 100} num={lv.max ?? `Lv ${lv.level} · ${lv.text}`} color={UI.growth} testID="stats-growth" />
      <MeterRow icon="heart" value={chem} color={UI.chem} testID="stats-chem" />
      <Pressable
        testID="stats-history-link"
        style={styles.link}
        onPress={() => {
          onClose();
          router.push("/history");
        }}
      >
        <Text style={styles.linkText}>Match History ›</Text>
      </Pressable>
    </View>
  );
}

// Icon in place of the word wherever one exists (Coins, Fans).
function Stat({ label, value, testID, icon }: { label: string; value: string; testID: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.stat} testID={testID} accessibilityLabel={`${label} ${value}`}>
      <View style={styles.statTop}>
        {icon}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      {icon ? null : <Text style={styles.statLabel}>{label}</Text>}
    </View>
  );
}

export function Overlay({ visible, title, onClose, children, testID }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <Card style={[styles.sheet, { backgroundColor: UI.cream }]} testID={testID}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable testID="overlay-close" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 4 }}>
              {children}
            </ScrollView>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  scrim: { flex: 1, backgroundColor: "rgba(20,26,18,0.6)", justifyContent: "center", paddingHorizontal: 20 },
  sheetWrap: { width: "100%", maxWidth: 420, alignSelf: "center", maxHeight: "100%" },
  sheet: { padding: 18, maxHeight: "100%" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeText: { color: UI.inkSoft, fontSize: 20, fontWeight: "700" },
  empty: { color: UI.muted, fontSize: 15, paddingVertical: 12, lineHeight: 21 },
  msgRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  msgSender: { color: UI.muted, fontSize: 11, fontWeight: "700" },
  msgText: { color: UI.ink, fontSize: 15, fontWeight: "700" },
  msgLine: { color: UI.inkSoft, fontSize: 12.5, marginTop: 1 },
  unreadDot: { position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: UI.red, borderWidth: 1.5, borderColor: UI.cream },
  cta: { minHeight: 44, maxWidth: 96, borderRadius: 10, backgroundColor: UI.gold, borderWidth: 1, borderColor: UI.goldDeep, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  ctaText: { color: UI.goldInk, fontSize: 11, fontWeight: "900", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { width: "31.5%", backgroundColor: UI.creamDeep, borderRadius: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: UI.line, minHeight: 56 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { color: UI.ink, fontSize: 20, fontWeight: "800" },
  statLabel: { color: UI.muted, fontSize: 11, marginTop: 2, fontWeight: "600" },
  partner: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  partnerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 18 },
  partnerSub: { color: UI.inkSoft, fontSize: 13 },
  link: { marginTop: 14, backgroundColor: UI.creamDeep, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: UI.line },
  linkText: { color: UI.ink, fontSize: 16, fontWeight: "800" },
});
