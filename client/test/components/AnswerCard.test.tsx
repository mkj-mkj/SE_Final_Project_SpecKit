import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { QuestionInfo, TeamView } from '@quiz/shared';
import * as api from '../../src/api';
import * as socket from '../../src/socket';
import * as storage from '../../src/storage';
import AnswerCard from '../../src/components/AnswerCard';
import { usePlay } from '../../src/hooks/usePlay';
import { useServerClock } from '../../src/hooks/useServerClock';
import { formatClock } from '../../src/format';
import { fakeConnection, makeTeamView } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/socket');

const Q3 = 'q3';
const GROUP: QuestionInfo = { id: 'q1', number: 1, isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] };
const SINGLE: QuestionInfo = { id: Q3, number: 3, isGroup: false, subCount: 1, subLabels: [''] };
type MySub = TeamView['mySubmissions'][string];

/** 以 props 直接渲染 AnswerCard（UT-UI-CARD-01、02、04、05） */
function renderCard(over: Partial<Parameters<typeof AnswerCard>[0]> = {}) {
  const props: Parameters<typeof AnswerCard>[0] = {
    question: SINGLE, phase: 'RUNNING', answers: [''], mySubmission: undefined,
    now: () => Date.now(), onChange: vi.fn(), onSubmit: vi.fn(), onWithdraw: vi.fn(),
    ...over,
  };
  const utils = render(<AnswerCard {...props} />);
  return { ...utils, props };
}

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
  it('UT-UI-CARD-01 phase READY 時所有輸入與送出 disabled，placeholder 為「等待老師開始」', () => {
    renderCard({ question: GROUP, phase: 'READY', answers: ['', ''] });
    for (const sub of [1, 2]) {
      const input = screen.getByTestId(`answer-input-1-${sub}`);
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('placeholder', '等待老師開始');
    }
    expect(screen.getByTestId('btn-submit-1')).toBeDisabled();
  });

  it('UT-UI-CARD-02 RUNNING 題組只填一格時送出 disabled，填滿後可用；只填空白視為空', () => {
    const { rerender, props } = renderCard({ question: GROUP, answers: ['CPU', ''] });
    expect(screen.getByTestId('answer-card-1')).toHaveTextContent('（1）');
    expect(screen.getByTestId('answer-card-1')).toHaveTextContent('（2）');
    expect(screen.getByTestId('btn-submit-1')).toBeDisabled();
    expect(screen.getByTestId('btn-submit-1')).toHaveTextContent('送出第 1 題');

    rerender(<AnswerCard {...props} answers={['CPU', '   ']} />);
    expect(screen.getByTestId('btn-submit-1')).toBeDisabled();

    rerender(<AnswerCard {...props} answers={['CPU', '作業系統']} />);
    expect(screen.getByTestId('btn-submit-1')).toBeEnabled();

    // 輸入時以整份答案陣列回報
    fireEvent.change(screen.getByTestId('answer-input-1-2'), { target: { value: 'OS' } });
    expect(props.onChange).toHaveBeenCalledWith(['CPU', 'OS']);
    fireEvent.click(screen.getByTestId('btn-submit-1'));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('UT-UI-CARD-04 active 剩 7 秒顯示「撤回（7 秒）」並無條件進位；時間到 0 時按鈕消失', () => {
    const serverTime = Date.now() - 3000;
    const mine: MySub = {
      id: 'sub-3', answers: ['0'], submittedBy: '小明', serverTime,
      status: 'active', withdrawableUntil: Date.now() + 7000,
    };
    const { props } = renderCard({ answers: ['0'], mySubmission: mine });
    expect(screen.getByTestId('answer-input-3-1')).toBeDisabled();
    expect(screen.getByTestId('answer-input-3-1')).toHaveValue('0');
    expect(screen.getByTestId('submitted-3')).toHaveTextContent(`已送出 ${formatClock(serverTime)}`);
    expect(screen.getByTestId('withdraw-countdown-3')).toHaveTextContent('撤回（7 秒）');

    act(() => { vi.advanceTimersByTime(700); });   // 剩 6300 ms
    expect(screen.getByTestId('withdraw-countdown-3')).toHaveTextContent('撤回（7 秒）');

    act(() => { vi.advanceTimersByTime(6100); });  // 剩 200 ms
    expect(screen.getByTestId('withdraw-countdown-3')).toHaveTextContent('撤回（1 秒）');
    fireEvent.click(screen.getByTestId('btn-withdraw-3'));
    expect(props.onWithdraw).toHaveBeenCalledWith('sub-3');

    act(() => { vi.advanceTimersByTime(250); });   // 已過期
    expect(screen.queryByTestId('btn-withdraw-3')).toBeNull();
    expect(screen.queryByTestId('withdraw-countdown-3')).toBeNull();
    expect(screen.getByTestId('submitted-3')).toHaveTextContent(`已送出 ${formatClock(serverTime)}`);
  });

  it('UT-UI-CARD-05 withdrawn 時輸入可編輯且帶入原答案，送出按鈕出現', () => {
    const mine: MySub = {
      id: 'sub-1', answers: ['CPU', 'OS'], submittedBy: '小明', serverTime: Date.now() - 2000,
      status: 'withdrawn', withdrawableUntil: null,
    };
    renderCard({ question: GROUP, answers: ['CPU', 'OS'], mySubmission: mine });
    expect(screen.getByTestId('answer-input-1-1')).toBeEnabled();
    expect(screen.getByTestId('answer-input-1-1')).toHaveValue('CPU');
    expect(screen.getByTestId('answer-input-1-2')).toHaveValue('OS');
    expect(screen.getByTestId('btn-submit-1')).toBeEnabled();
    expect(screen.queryByTestId('submitted-1')).toBeNull();
    expect(screen.queryByTestId('btn-withdraw-1')).toBeNull();
  });

  it('UT-UI-CARD-06 rejected 時輸入 disabled 並顯示原答案、顯示「老師判定此答案錯誤」、無送出與撤回按鈕', () => {
    const mine: MySub = {
      id: 'sub-3', answers: ['0'], submittedBy: '小明', serverTime: Date.now() - 2000,
      status: 'rejected', withdrawableUntil: null,
    };
    renderCard({ answers: [''], mySubmission: mine });
    expect(screen.getByTestId('answer-input-3-1')).toBeDisabled();
    expect(screen.getByTestId('answer-input-3-1')).toHaveValue('0');
    expect(screen.getByText('老師判定此答案錯誤')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-submit-3')).toBeNull();
    expect(screen.queryByTestId('btn-withdraw-3')).toBeNull();
  });
});
