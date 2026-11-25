// 活動設定表單：組數、判定模式、視窗秒數（TECH_SPEC §10.4）；只在 SETUP／READY 可編輯
// 超出範圍提示使用 TECH_SPEC §11 的 INVALID_INPUT 訊息
import { useEffect, useState, type FormEvent } from 'react';
import {
  MAX_TEAM_COUNT,
  MAX_WINDOW_SEC,
  MIN_TEAM_COUNT,
  MIN_WINDOW_SEC,
  type FairnessMode,
  type Session,
} from '@quiz/shared';
import type { SettingsInput } from '../api';
import { messageOf } from '../messages';

interface Props {
  session: Session;
  onSave: (input: SettingsInput) => void | Promise<void>;
  disabled?: boolean;
}

function parseIntIn(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= min && n <= max ? n : null;
}

export default function SettingsForm({ session, onSave, disabled = false }: Props) {
  const [teamCount, setTeamCount] = useState(String(session.teamCount));
  const [mode, setMode] = useState<FairnessMode>(session.fairnessMode);
  const [windowSec, setWindowSec] = useState(String(session.windowSec));

  // 伺服器設定變動時（例如另一個分頁儲存）同步本地值
  useEffect(() => {
    setTeamCount(String(session.teamCount));
    setMode(session.fairnessMode);
    setWindowSec(String(session.windowSec));
  }, [session.teamCount, session.fairnessMode, session.windowSec]);

  const editable = !disabled && (session.phase === 'SETUP' || session.phase === 'READY');
  const teamCountValue = parseIntIn(teamCount, MIN_TEAM_COUNT, MAX_TEAM_COUNT);
  const windowSecValue = parseIntIn(windowSec, MIN_WINDOW_SEC, MAX_WINDOW_SEC);
  const valid = teamCountValue !== null && (mode === 'speed' || windowSecValue !== null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editable || !valid) return;
    const input: SettingsInput = { teamCount: teamCountValue, fairnessMode: mode };
    if (mode === 'fair') input.windowSec = windowSecValue as number;
    void onSave(input);
  }

  return (
    <form onSubmit={onSubmit} className="settings-form">
      <label>
        組數
        <input
          data-testid="settings-team-count"
          type="number"
          min={MIN_TEAM_COUNT}
          max={MAX_TEAM_COUNT}
          value={teamCount}
          disabled={!editable}
          onChange={(e) => setTeamCount(e.target.value)}
        />
      </label>
      {teamCountValue === null && (
        <span className="field-error">{messageOf('INVALID_INPUT')}</span>
      )}
      <fieldset disabled={!editable}>
        <legend>判定模式</legend>
        <label>
          <input
            data-testid="settings-mode-fair"
            type="radio"
            name="fairnessMode"
            checked={mode === 'fair'}
            onChange={() => setMode('fair')}
          />
          公平
        </label>
        <label>
          <input
            data-testid="settings-mode-speed"
            type="radio"
            name="fairnessMode"
            checked={mode === 'speed'}
            onChange={() => setMode('speed')}
          />
          純速度
        </label>
      </fieldset>
      {mode === 'fair' && (
        <label>
          視窗
          <input
            data-testid="settings-window-sec"
            type="number"
            min={MIN_WINDOW_SEC}
            max={MAX_WINDOW_SEC}
            value={windowSec}
            disabled={!editable}
            onChange={(e) => setWindowSec(e.target.value)}
          />
          秒
        </label>
      )}
      {mode === 'fair' && windowSecValue === null && (
        <span className="field-error">{messageOf('INVALID_INPUT')}</span>
      )}
      <button data-testid="settings-save" type="submit" disabled={!editable || !valid}>儲存</button>
    </form>
  );
}
