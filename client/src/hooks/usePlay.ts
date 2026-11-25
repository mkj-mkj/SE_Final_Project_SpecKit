// 學生端狀態（TECH_SPEC §10.3）：001 的 view、me、error；003 的 setDraft、submit、withdraw
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DRAFT_DEBOUNCE_MS, type TeamView } from '@quiz/shared';
import * as api from '../api';
import type { AppErrorView } from '../api';
import { toAppError } from '../errors';
import { connectMember } from '../socket';
import { clearMember, loadMember } from '../storage';

export interface UsePlay {
  view: TeamView | null;
  me: { id: string; nickname: string } | null;
  error: AppErrorView | null;
  setDraft(questionId: string, answers: string[]): void;
  submit(questionId: string): Promise<void>;
  withdraw(submissionId: string): Promise<void>;
}

/** 距上次本地輸入未滿此毫秒數的題目，收到快照時保留本地值（避免游標跳動，spec FR-017） */
const KEEP_LOCAL_MS = 1000;

interface LocalDraft { answers: string[]; updatedAt: number }

export function usePlay(): UsePlay {
  const navigate = useNavigate();
  const [member] = useState(() => loadMember());
  const [serverView, setServerView] = useState<TeamView | null>(null);
  const [me, setMe] = useState<UsePlay['me']>(null);
  const [error, setError] = useState<AppErrorView | null>(null);
  const [ready, setReady] = useState(false);
  // 本地草稿：只保存「本機輸入且尚未被快照取代」的題目（key = questionId）
  const [localDrafts, setLocalDrafts] = useState<Record<string, LocalDraft>>({});
  const lastInputAt = useRef<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const onUnauthorized = useCallback(() => {
    clearMember();
    const room = member?.roomCode ?? '';
    navigate(room ? `/join?room=${encodeURIComponent(room)}` : '/join', { replace: true });
  }, [member, navigate]);

  /** 共用的錯誤處理：401 → 清除身分並回 /join；其餘存入 error（由 ErrorBanner 顯示） */
  const fail = useCallback((e: unknown) => {
    const err = toAppError(e);
    if (err.code === 'UNAUTHORIZED') onUnauthorized();
    else setError(err);
  }, [onUnauthorized]);

  /**
   * 套用伺服器快照：距上次本地輸入 < 1 秒的題目保留本地值，
   * 其餘丟棄本地草稿，改以快照的 drafts 為準（TECH_SPEC §10.3）。
   */
  const applySnapshot = useCallback((s: TeamView) => {
    setServerView(s);
    const now = Date.now();
    setLocalDrafts((prev) => {
      const next: Record<string, LocalDraft> = {};
      for (const [qid, d] of Object.entries(prev)) {
        if (now - (lastInputAt.current[qid] ?? 0) < KEEP_LOCAL_MS) next[qid] = d;
      }
      return next;
    });
  }, []);

  // 掛載：無身分 → /join；否則取得初始狀態
  useEffect(() => {
    if (!member) {
      navigate('/join', { replace: true });
      return;
    }
    let active = true;
    api.getPlayState(member.token)
      .then(({ me: self, ...teamView }) => {
        if (!active) return;
        applySnapshot(teamView);
        setMe(self);
        setReady(true);
      })
      .catch((e: unknown) => {
        if (active) fail(e);
      });
    return () => { active = false; };
  }, [member, navigate, fail, applySnapshot]);

  // 取得初始狀態後訂閱 team:state
  useEffect(() => {
    if (!member || !ready) return;
    const conn = connectMember(member.token);
    conn.onState(applySnapshot);
    conn.onUnauthorized(onUnauthorized);
    return () => conn.disconnect();
  }, [member, ready, onUnauthorized, applySnapshot]);

  // 卸載時取消所有尚未送出的草稿 debounce
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of Object.values(pending)) clearTimeout(t);
    };
  }, []);

  /**
   * 對外的 view：把本地草稿合併進 drafts（research R-11），不新增 TECH_SPEC 以外的欄位。
   * 優先順序：本地輸入 > 快照草稿 > 撤回的答案（快照沒有草稿且 mySubmission 為 withdrawn）。
   */
  const view = useMemo<TeamView | null>(() => {
    if (!serverView) return null;
    const drafts: TeamView['drafts'] = { ...serverView.drafts };
    for (const q of serverView.questions) {
      const local = localDrafts[q.id];
      const sub = serverView.mySubmissions[q.id];
      if (local) {
        drafts[q.id] = { answers: local.answers, updatedBy: me?.id ?? '', updatedAt: local.updatedAt };
      } else if (!drafts[q.id] && sub?.status === 'withdrawn') {
        drafts[q.id] = { answers: sub.answers, updatedBy: sub.submittedBy, updatedAt: sub.serverTime };
      }
    }
    return { ...serverView, drafts };
  }, [serverView, localDrafts, me]);

  const viewRef = useRef(view);
  viewRef.current = view;

  const cancelDebounce = useCallback((questionId: string) => {
    const t = timers.current[questionId];
    if (t !== undefined) clearTimeout(t);
    delete timers.current[questionId];
  }, []);

  /** 立即更新本地草稿；每題各自 300 ms debounce 後 PUT（組內共編，US4） */
  const setDraft = useCallback((questionId: string, answers: string[]) => {
    if (!member) return;
    const now = Date.now();
    lastInputAt.current[questionId] = now;
    setLocalDrafts((prev) => ({ ...prev, [questionId]: { answers, updatedAt: now } }));
    cancelDebounce(questionId);
    timers.current[questionId] = setTimeout(() => {
      delete timers.current[questionId];
      api.putDraft(member.token, questionId, answers).catch(fail);
    }, DRAFT_DEBOUNCE_MS);
  }, [member, fail, cancelDebounce]);

  /** 以本地目前內容送出；先取消該題尚未送出的草稿 PUT */
  const submit = useCallback(async (questionId: string) => {
    if (!member) return;
    cancelDebounce(questionId);
    const v = viewRef.current;
    const q = v?.questions.find((x) => x.id === questionId);
    const answers = v?.drafts[questionId]?.answers ?? Array<string>(q?.subCount ?? 1).fill('');
    setError(null);
    try {
      await api.submit(member.token, questionId, answers);
      // 送出成功後該題改以快照為準（輸入框顯示已送出的答案）
      delete lastInputAt.current[questionId];
      setLocalDrafts((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch (e) {
      fail(e);
    }
  }, [member, fail, cancelDebounce]);

  const withdraw = useCallback(async (submissionId: string) => {
    if (!member) return;
    setError(null);
    try {
      await api.withdraw(member.token, submissionId);
    } catch (e) {
      fail(e);
    }
  }, [member, fail]);

  return { view, me, error, setDraft, submit, withdraw };
}
