// 錯誤訊息橫幅：以 messageOf(error.code) 顯示中文訊息（TECH_SPEC §10.6）
// 例外：DUPLICATE_QUESTION_NUMBER 顯示伺服器回傳的 error.message（含重複題號，例「題號重複：2」）
import type { AppErrorView } from '../api';
import { messageOf } from '../messages';

export function bannerText(error: AppErrorView): string {
  if (error.code === 'DUPLICATE_QUESTION_NUMBER' && error.message) return error.message;
  return messageOf(error.code);
}

export default function ErrorBanner({ error }: { error: AppErrorView | null }) {
  if (!error) return null;
  return (
    <div data-testid="error-banner" role="alert" className="error-banner">
      {bannerText(error)}
    </div>
  );
}
