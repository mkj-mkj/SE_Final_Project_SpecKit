// 老師控制列（TECH_SPEC §10.4）：開始／結束／重新開始；按下即執行，沒有確認步驟（research D1）
import type { Phase } from '@quiz/shared';

interface Props {
  phase: Phase;
  busy: boolean;
  onStart(): void;
  onEnd(): void;
  onReset(): void;
}

export default function ControlBar({ phase, busy, onStart, onEnd, onReset }: Props) {
  // 依階段只有對應的一顆可用；SETUP（尚未匯入）或請求進行中時全部停用
  const enabled = (p: Phase) => !busy && phase === p;
  return (
    <div className="control-bar">
      <button data-testid="btn-start" type="button" disabled={!enabled('READY')} onClick={onStart}>
        開始搶答
      </button>
      <button data-testid="btn-end" type="button" disabled={!enabled('RUNNING')} onClick={onEnd}>
        結束搶答
      </button>
      <button data-testid="btn-reset" type="button" disabled={!enabled('ENDED')} onClick={onReset}>
        重新開始一輪
      </button>
    </div>
  );
}
