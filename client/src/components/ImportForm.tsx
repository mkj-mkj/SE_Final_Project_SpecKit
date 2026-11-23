// 匯入表單（TECH_SPEC §10.4、contracts/ui-testids.md）：貼上試算表網址或 ID 後匯入。
// 錯誤橫幅由 TeacherDashboard 唯一的 ErrorBanner 顯示；本元件只在 HEADER_NOT_FOUND 時顯示範本格式說明。
import { useState, type FormEvent } from 'react';
import type { ErrorCode } from '@quiz/shared';
import { toAppError } from '../errors';

interface Props {
  onImport: (spreadsheet: string) => Promise<unknown>;
  busy: boolean;
}

const HEADER_NOT_FOUND: ErrorCode = 'HEADER_NOT_FOUND';

export default function ImportForm({ onImport, busy }: Props) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  const value = input.trim();
  const disabled = value === '' || busy || submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setShowFormatHelp(false); // 下次送出時清除格式說明
    try {
      await onImport(value);
    } catch (err) {
      if (toAppError(err).code === HEADER_NOT_FOUND) setShowFormatHelp(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="import-form">
      <label>
        試算表網址或 ID
        <input
          data-testid="import-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </label>
      <button data-testid="import-submit" type="submit" disabled={disabled}>
        {submitting ? '匯入中…' : '匯入'}
      </button>
      {showFormatHelp && (
        <div className="import-format-help">
          <p>範本格式說明</p>
          <ol>
            <li>需有一列同時含「題號」與「作答」兩個儲存格。</li>
            <li>題號欄填整數（例：1、2、3）。</li>
            <li>題組：將題號儲存格向下合併 n 列。</li>
            <li>子題作答格可用「（1）」「（2）」開頭標示。</li>
          </ol>
        </div>
      )}
    </form>
  );
}
