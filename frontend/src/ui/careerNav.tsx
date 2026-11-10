// PLAY on a Career match (Home card and Passport): the Match talk on a first
// play, otherwise straight into the match. Match 1 while the tutorial is still
// offered: the "New to pickleball?" pop-up first, once.
import { useRouter } from "expo-router";
import React, { useState } from "react";

import { meta } from "@/src/game/meta";
import { FIRST_CAREER_MATCH_ID } from "@/src/game/meta/economyConfig";
import { partnerOf, showTalk } from "@/src/game/meta/matchSetup";
import type { SaveDoc } from "@/src/game/meta/metaStore";
import { showMatch1Prompt, tutorialEvents, type TutorialFrom } from "@/src/game/meta/tutorial";
import { TutorialOffer } from "./TutorialOffer";

type Router = ReturnType<typeof useRouter>;

export function playCareerMatch(router: Router, save: Pick<SaveDoc, "career"> | null, careerId: string) {
  if (save && showTalk(save.career, careerId)) router.push({ pathname: "/talk", params: { careerId } });
  else router.push({ pathname: "/match", params: { mode: "career", careerId } });
}

export function startTutorial(router: Router, from: TutorialFrom) {
  router.push({ pathname: "/match", params: { mode: "tutorial", from } });
}

export function useCareerPlay(save: SaveDoc | null, onChange: () => void): { play: (careerId: string) => void; prompt: React.ReactNode } {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const play = (careerId: string) => {
    if (meta.loaded && showMatch1Prompt(meta.doc, careerId)) {
      meta.tutorialPrompted();
      tutorialEvents.offered("match1");
      onChange();
      setOpen(true);
      return;
    }
    playCareerMatch(router, meta.loaded ? meta.doc : save, careerId);
  };
  const prompt = (
    <TutorialOffer
      visible={open}
      testID="match1-prompt"
      kicker="BEFORE MATCH 1"
      partnerName={partnerOf(save?.activePartnerId).name}
      secondary="Play Match 1"
      onLearn={() => {
        setOpen(false);
        startTutorial(router, "match1");
      }}
      onSecondary={() => {
        setOpen(false);
        playCareerMatch(router, meta.loaded ? meta.doc : save, FIRST_CAREER_MATCH_ID);
      }}
      onClose={() => setOpen(false)}
    />
  );
  return { play, prompt };
}
