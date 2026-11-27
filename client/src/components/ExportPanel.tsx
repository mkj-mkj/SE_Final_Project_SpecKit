// 寫回／還原／下載 CSV（TECH_SPEC §10.4；contracts/ui-testids.md）
// export-result 只顯示最近一次成功的結果；失敗時清除，錯誤訊息由 TeacherDashboard 的 ErrorBanner 顯示
import { useState } from 'react';
import type { Phase } from '@quiz/shared';

interface Props {
  phase: Phase;
  busy: boolean;
  onExport(): Promise<number>;
  onRestore(): Promise<number>;
  onDownload(): Promise<void>;
}

export default function ExportPanel({ phase, busy, onExport, onRestore, onDownload }: Props) {
  const [result, setResult] = useState<string | null>(null);
  const ended = phase === 'ENDED';
  // 寫回與 CSV 只在結束後；還原在 READY（重新開始一輪後）與 ENDED 皆可
  const canRestore = phase === 'READY' || ended;

  async function run(fn: () => Promise<number>, label: (n: number) => string) {
    setResult(null);
    try {
      const n = await fn();
      setResult(label(n));
    } catch {
      setResult(null);
    }
  }

  return (
    <div className="export-panel">
      <button
        data-testid="btn-export-sheet" type="button" disabled={!ended || busy}
        onClick={() => void run(onExport, (n) => `已寫回 ${n} 格`)}
      >
        寫回 Google Sheets
      </button>
      <button
        data-testid="btn-restore-sheet" type="button" disabled={!canRestore || busy}
        // 「已還原 N 格」：plan D3（spec Clarifications Q3）
        onClick={() => void run(onRestore, (n) => `已還原 ${n} 格`)}
      >
        還原原始內容
      </button>
      <button
        data-testid="btn-download-csv" type="button" disabled={!ended || busy}
        onClick={() => { onDownload().catch(() => undefined); }}
      >
        下載 CSV
      </button>
      {result && <p data-testid="export-result">{result}</p>}
    </div>
  );
}
