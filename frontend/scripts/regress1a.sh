#!/bin/bash
# Phase 1A regression gate: run.ts summary, b3Report/shotMix byte-diff vs the fbb61cc baseline, phase1a tests, step bench.
cd /app/frontend
npx tsx src/game/__tests__/run.ts > /tmp/cur_run.txt 2>&1; tail -1 /tmp/cur_run.txt; grep "human smash" /tmp/cur_run.txt
npx tsx src/game/__tests__/b3Report.ts 30 > /tmp/cur_b3.txt 2>&1
npx tsx src/game/__tests__/shotMix.ts > /tmp/cur_shotmix.txt 2>&1
cmp -s /tmp/base/b3.txt /tmp/cur_b3.txt && echo "b3Report: BYTE-IDENTICAL" || { echo "b3Report: DIFF"; diff /tmp/base/b3.txt /tmp/cur_b3.txt; }
cmp -s /tmp/base/shotmix.txt /tmp/cur_shotmix.txt && echo "shotMix: BYTE-IDENTICAL" || { echo "shotMix: DIFF"; diff /tmp/base/shotmix.txt /tmp/cur_shotmix.txt; }
npx tsx src/game/__tests__/phase1a.ts 2>&1 | grep -E "FAIL|RESULT"
npx tsx src/game/__tests__/stepBench.ts 7
