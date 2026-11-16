// 首頁：選擇身分（TECH_SPEC §10.1）
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="home">
      <h1>課堂搶答</h1>
      <nav>
        <Link to="/teacher">我是老師</Link>
        {' '}
        <Link to="/join">我是學生</Link>
      </nav>
    </main>
  );
}
