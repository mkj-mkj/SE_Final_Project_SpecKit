import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../src/api';
import * as storage from '../../src/storage';
import LoginForm from '../../src/components/LoginForm';
import { LocationProbe } from '../helpers/LocationProbe';
import { appError } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage')>();
  return { ...actual, saveTeacher: vi.fn(actual.saveTeacher) };
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/teacher/login']}>
      <Routes>
        <Route path="/teacher/login" element={<LoginForm />} />
        <Route path="/teacher" element={<div>dashboard</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.clearAllMocks());

  it('UT-UI-LOGIN-01 送出密碼 → 呼叫 api.login；成功 saveTeacher 並導向 /teacher', async () => {
    vi.mocked(api.login).mockResolvedValue({ token: 't-token' });
    renderLogin();
    await userEvent.type(screen.getByTestId('teacher-password'), 'secret');
    await userEvent.click(screen.getByTestId('teacher-login-submit'));

    expect(api.login).toHaveBeenCalledWith('secret');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/teacher$/));
    expect(storage.saveTeacher).toHaveBeenCalledWith({ token: 't-token' });
    expect(storage.loadTeacher()).toEqual({ token: 't-token' });
  });

  it('UT-UI-LOGIN-02 api 回 UNAUTHORIZED → error-banner 顯示對應訊息', async () => {
    vi.mocked(api.login).mockRejectedValue(appError('UNAUTHORIZED'));
    renderLogin();
    await userEvent.type(screen.getByTestId('teacher-password'), 'wrong');
    await userEvent.click(screen.getByTestId('teacher-login-submit'));

    expect(await screen.findByTestId('error-banner')).toHaveTextContent('驗證失敗，請重新登入或加入');
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher/login');
    expect(storage.saveTeacher).not.toHaveBeenCalled();
  });
});
