// 建立「搶答中」的測試活動（TEST_SPEC §3）。
// 預設：範例 A、3 組、每組 2 人、純速度、視窗 3 秒；流程 createSession → importSheet → 各組 join → start。
import type { makeTestService } from './makeTestService.js';

/** 範例 A 各題的正確格式答案（題組為兩格） */
export const ANSWERS: Record<number, string[]> = {
  1: ['CPU', '作業系統'],
  2: ['演算法', '堆疊'],
  3: ['0'],
  4: ['IP'],
};

export async function seedRunning(
  t: ReturnType<typeof makeTestService>,
  opts?: {
    fixture?: 'template-a' | 'template-b';
    teams?: number;
    membersPerTeam?: number;
    mode?: 'speed' | 'fair';
    windowSec?: number;
  },
): Promise<{
  sessionId: string;
  teamIds: string[];
  tokens: string[][]; // tokens[teamIndex-1][memberIndex]
  q: Record<number, string>; // 題號 → questionId
}> {
  const fixture = opts?.fixture ?? 'template-a';
  const teams = opts?.teams ?? 3;
  const membersPerTeam = opts?.membersPerTeam ?? 2;
  const mode = opts?.mode ?? 'speed';
  const windowSec = opts?.windowSec ?? 3;

  const created = t.service.createSession({ teamCount: teams, fairnessMode: mode, windowSec });
  const sessionId = created.session.id;
  await t.service.importSheet(sessionId, `fixture-${fixture}`);

  const teamIds = t.repo.listTeams(sessionId).map((x) => x.id);
  const tokens = teamIds.map((teamId, i) =>
    Array.from({ length: membersPerTeam }, (_, j) =>
      // 暱稱只用英數字，符合暱稱規則
      t.service.join(created.session.roomCode, { teamId, nickname: `T${i + 1}M${j + 1}` }).token,
    ),
  );

  t.service.start(sessionId);
  const q = Object.fromEntries(t.repo.listQuestions(sessionId).map((x) => [x.number, x.id])) as Record<number, string>;
  return { sessionId, teamIds, tokens, q };
}
