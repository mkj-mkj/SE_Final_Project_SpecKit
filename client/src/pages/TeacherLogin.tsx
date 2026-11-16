// 老師登入頁（TECH_SPEC §10.1）
import LoginForm from '../components/LoginForm';

export default function TeacherLogin() {
  return (
    <main className="teacher-login">
      <h1>課堂搶答 · 老師登入</h1>
      <LoginForm />
    </main>
  );
}
