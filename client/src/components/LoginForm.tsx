// 老師登入表單（TECH_SPEC §10.4）
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, type AppErrorView } from '../api';
import { toAppError } from '../errors';
import { saveTeacher } from '../storage';
import ErrorBanner from './ErrorBanner';

export default function LoginForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppErrorView | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await login(password);
      saveTeacher({ token });
      navigate('/teacher');
    } catch (err) {
      setError(toAppError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label>
        老師密碼
        <input
          data-testid="teacher-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <button data-testid="teacher-login-submit" type="submit" disabled={busy}>登入</button>
      <ErrorBanner error={error} />
    </form>
  );
}
