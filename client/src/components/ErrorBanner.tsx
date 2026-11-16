// 錯誤訊息橫幅：以 messageOf(error.code) 顯示中文訊息（TECH_SPEC §10.6）
import type { AppErrorView } from '../api';
import { messageOf } from '../messages';

export default function ErrorBanner({ error }: { error: AppErrorView | null }) {
  if (!error) return null;
  return (
    <div data-testid="error-banner" role="alert" className="error-banner">
      {messageOf(error.code)}
    </div>
  );
}
