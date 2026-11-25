import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TeamView } from '@quiz/shared';
import * as api from '../../src/api';
import * as socket from '../../src/socket';
import * as storage from '../../src/storage';
import AnswerCard from '../../src/components/AnswerCard';
import { usePlay } from '../../src/hooks/usePlay';
import { useServerClock } from '../../src/hooks/useServerClock';
import { fakeConnection, makeTeamView } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/socket');

const Q3 = 'q3';

/** RUNNING 的 TeamView：第 1 題題組、第 2、3 題單題 */
function runningView(drafts: TeamView['drafts'] = {}): TeamView {
  const base = makeTeamView();
  return {
    ...base,
    session: { roomCode: 'K7Q2MX', phase: 'RUNNING', round: 1 },
    questions: [
      { id: 'q1', number: 1, isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] },
      { id: 'q2', number: 2, isGroup: false, subCount: 1, subLabels: [''] },
      { id: Q3, number: 3, isGroup: false, subCount: 1, subLabels: [''] },
    ],
    drafts,
    serverNow: Date.now(),
  };
}

/** 測試用 harness：以 usePlay 的 view 與 setDraft 渲染第 3 題 AnswerCard */
function Harness() {
  const { view, setDraft, submit, withdraw } = usePlay();
  const now = useServerClock(view?.serverNow);
  if (!view) return null;
  const q = view.questions.find((x) => x.number === 3)!;
  return (
    <AnswerCard
      question={q}
      phase={view.session.phase}
      answers={view.drafts[q.id]?.answers ?? Array<string>(q.subCount).fill('')}
      mySubmission={view.mySubmissions[q.id]}
      now={now}
      onChange={(answers) => setDraft(q.id, answers)}
      onSubmit={() => { void submit(q.id); }}
      onWithdraw={(id) => { void withdraw(id); }}
    />
  );
}

describe('AnswerCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('UT-UI-CARD-03 連續輸入只在最後一次輸入 300 ms 後 PUT 一次；1 秒內的快照不覆蓋本地輸入', async () => {
    storage.saveMember({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm1' });
    const conn = fakeConnection<TeamView>();
    vi.mocked(socket.connectMember).mockReturnValue(conn);
    vi.mocked(api.getPlayState).mockResolvedValue({ ...runningView(), me: { id: 'm1', nickname: '小明' } });
    vi.mocked(api.putDraft).mockResolvedValue(undefined);

    render(<MemoryRouter><Harness /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const input = screen.getByTestId('answer-input-3-1');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.change(input, { target: { value: '01' } });
    fireEvent.change(input, { target: { value: '012' } });

    act(() => { vi.advanceTimersByTime(299); });
    expect(api.putDraft).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(api.putDraft).toHaveBeenCalledTimes(1);
    expect(api.putDraft).toHaveBeenCalledWith('m-token', Q3, ['012']);

    // 輸入後 500 ms 內收到他人草稿快照 → 保留本地值（spec FR-017）
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { conn.emitState(runningView({ [Q3]: { answers: ['x'], updatedBy: 'm2', updatedAt: Date.now() } })); });
    expect(screen.getByTestId('answer-input-3-1')).toHaveValue('012');

    // 距上次輸入超過 1 秒後再推送 → 以快照取代
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { conn.emitState(runningView({ [Q3]: { answers: ['x'], updatedBy: 'm2', updatedAt: Date.now() } })); });
    expect(screen.getByTestId('answer-input-3-1')).toHaveValue('x');
  });
});
