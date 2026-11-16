// 階段徽章（TECH_SPEC §10.4）
import type { Phase } from '@quiz/shared';

const LABELS: Record<Phase, string> = {
  SETUP: '準備中',
  READY: '等待開始',
  RUNNING: '搶答中',
  ENDED: '已結束',
};

export default function PhaseBadge({ phase }: { phase: Phase }) {
  return <span data-testid="phase-badge" className={`phase-badge phase-${phase.toLowerCase()}`}>{LABELS[phase]}</span>;
}
