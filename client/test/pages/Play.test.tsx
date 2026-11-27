import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { TeamView } from '@quiz/shared';
import type { PlayState } from '../../src/api';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../src/api';
import * as socket from '../../src/socket';
import * as storage from '../../src/storage';
import Play from '../../src/pages/Play';
import { LocationProbe } from '../helpers/LocationProbe';
import { appError, fakeConnection, makePlayState, makeTeamView } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/socket');
vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage')>();
  return { ...actual, clearMember: vi.fn(actual.clearMember) };
});

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/play']}>
      <Routes>
        <Route path="/play" element={<Play />} />
        <Route path="/join" element={<div>join page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Play', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(socket.connectMember).mockImplementation(() => fakeConnection());
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('UT-UI-PLAY-01 無 member token → 導向 /join', async () => {
    renderPlay();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/join$/));
    expect(api.getPlayState).not.toHaveBeenCalled();
  });

  it('UT-UI-PLAY-02 GET /state 回 401 → clearMember 並導向 /join?room=<roomCode>', async () => {
    storage.saveMember({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm1' });
    vi.mocked(api.getPlayState).mockRejectedValue(appError('UNAUTHORIZED'));
    renderPlay();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/join?room=K7Q2MX'));
    expect(api.getPlayState).toHaveBeenCalledWith('m-token');
    expect(storage.clearMember).toHaveBeenCalled();
    expect(storage.loadMember()).toBeNull();
  });

  it('UT-UI-PLAY-03 推送 ENDED 的 view → 顯示 student-results 與各組分數，不顯示 AnswerCard 與判錯按鈕', async () => {
    storage.saveMember({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm1' });
    const questions: TeamView['questions'] = [
      { id: 'q1', number: 1, isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] },
      { id: 'q2', number: 2, isGroup: false, subCount: 1, subLabels: [''] },
      { id: 'q3', number: 3, isGroup: false, subCount: 1, subLabels: [''] },
      { id: 'q4', number: 4, isGroup: false, subCount: 1, subLabels: [''] },
    ];
    const running: PlayState = {
      ...makePlayState(),
      session: { roomCode: 'K7Q2MX', phase: 'RUNNING', round: 1 },
      questions,
    };
    vi.mocked(api.getPlayState).mockResolvedValue(running);
    const conn = fakeConnection<TeamView>();
    vi.mocked(socket.connectMember).mockImplementation(() => conn);

    renderPlay();
    expect(await screen.findByTestId('answer-card-1')).toBeInTheDocument();

    const rank = (teamId: string, teamName: string, answers: string[], r: number, isWinner: boolean,
      status: 'active' | 'rejected' = 'active') =>
      ({ rank: r, teamId, teamName, answers, submittedBy: '小明', serverTime: 1000 * r, status, isWinner });
    const ended: TeamView = {
      ...makeTeamView(),
      session: { roomCode: 'K7Q2MX', phase: 'ENDED', round: 1 },
      questions,
      results: {
        questions: [
          { questionId: 'q1', number: 1, isGroup: true, subLabels: ['（1）', '（2）'],
            winner: { teamId: 't2', teamName: '第 2 組', answers: ['CPU', '作業系統'], submittedBy: '阿傑' },
            ranking: [rank('t2', '第 2 組', ['CPU', '作業系統'], 1, true)] },
          { questionId: 'q2', number: 2, isGroup: false, subLabels: [''], winner: null, ranking: [] },
          { questionId: 'q3', number: 3, isGroup: false, subLabels: [''],
            winner: { teamId: 't1', teamName: '第 1 組', answers: ['0'], submittedBy: '小明' },
            ranking: [rank('t3', '第 3 組', ['9'], 1, false, 'rejected'), rank('t1', '第 1 組', ['0'], 2, true)] },
          { questionId: 'q4', number: 4, isGroup: false, subLabels: [''], winner: null, ranking: [] },
        ],
        scores: [
          { teamId: 't1', teamName: '第 1 組', score: 1 },
          { teamId: 't2', teamName: '第 2 組', score: 1 },
          { teamId: 't3', teamName: '第 3 組', score: 0 },
        ],
      },
    };
    act(() => conn.emitState(ended));

    const results = await screen.findByTestId('student-results');
    expect(screen.getByTestId('student-result-1')).toHaveTextContent('第 2 組');
    expect(screen.getByTestId('student-result-1')).toHaveTextContent('（1）CPU（2）作業系統');
    expect(screen.getByTestId('student-result-3')).toHaveTextContent('第 1 組');
    expect(screen.getByTestId('student-result-3')).toHaveTextContent('第 3 組（判錯）');
    expect(screen.getByTestId('student-result-2')).toHaveTextContent('無');
    expect(screen.queryAllByTestId(/^answer-card-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^btn-reject-/)).toHaveLength(0);
    // 各組分數（spec Clarifications Q2）
    expect(results.textContent).toMatch(/第 1 組\D*1.*第 2 組\D*1.*第 3 組\D*0/s);
    expect(screen.getByTestId('team-name')).toBeInTheDocument();
    expect(screen.getByTestId('phase-badge')).toBeInTheDocument();
  });
});
