// PLAY on a Career match (Home card and Passport): the Match talk on a first
// play, otherwise straight into the match.
import type { useRouter } from "expo-router";

import { showTalk } from "@/src/game/meta/matchSetup";
import type { SaveDoc } from "@/src/game/meta/metaStore";

type Router = ReturnType<typeof useRouter>;

export function playCareerMatch(router: Router, save: SaveDoc | null, careerId: string) {
  if (save && showTalk(save.career, careerId)) router.push({ pathname: "/talk", params: { careerId } });
  else router.push({ pathname: "/match", params: { mode: "career", careerId } });
}
