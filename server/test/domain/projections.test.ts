import type { Member, Session, Team } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { projectTeacherView, type SessionAggregate } from '../../src/domain/projections.js';

const NOW = 1_700_000_000_000;

// TEST_SPEC UT-PROJ 測試資料：2 組（A、B），B 的暱稱為 SECRETNICKB
function makeAgg(onlineMemberIds: string[]): SessionAggregate {
  const session: Session = {
    id: 'ses_1',
    roomCode: 'AAAAA2',
    phase: 'RUNNING',
    spreadsheetId: null,
    sheetTitle: null,
    fairnessMode: 'fair',
    windowSec: 3,
    teamCount: 2,
    round: 1,
    createdAt: NOW,
    startedAt: NOW,
    endedAt: null,
  };
  const teams: Team[] = [
    { id: 'team_A', sessionId: 'ses_1', index: 1, name: '第 1 組' },
    { id: 'team_B', sessionId: 'ses_1', index: 2, name: '第 2 組' },
  ];
  const member = (id: string, teamId: string, nickname: string): Member => ({
    id,
    teamId,
    nickname,
    token: `tok_${id}`,
    joinedAt: NOW,
    lastSeenAt: NOW,
  });
  return {
    session,
    questions: [],
    slots: [],
    teams,
    members: [member('mem_A1', 'team_A', 'Amy'), member('mem_A2', 'team_A', 'Ben'), member('mem_B1', 'team_B', 'SECRETNICKB')],
    drafts: [],
    submissions: [],
    onlineMemberIds: new Set(onlineMemberIds),
  };
}

describe('projections', () => {
  it('UT-PROJ-10 onlineMemberIds 只有 A1 → TeacherView 中 A1 online=true，其他 false', () => {
    const view = projectTeacherView(makeAgg(['mem_A1']), NOW);
    const online = Object.fromEntries(view.teams.flatMap((t) => t.members.map((m) => [m.id, m.online])));
    expect(online).toEqual({ mem_A1: true, mem_A2: false, mem_B1: false });
  });
});
