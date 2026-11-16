// 在測試中顯示目前路徑，用來驗證導頁結果
import { useLocation } from 'react-router-dom';

export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}
