import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../src/api';
import * as socket from '../../src/socket';
import * as storage from '../../src/storage';
import TeacherDashboard from '../../src/pages/TeacherDashboard';
import { LocationProbe } from '../helpers/LocationProbe';
import { appError, fakeConnection, makeTeacherView } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/socket');
vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage')>();
  return { ...actual, clearTeacher: vi.fn(actual.clearTeacher) };
});

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/teacher']}>
      <Routes>
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/login" element={<div>login page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('TeacherDashboard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    storage.saveTeacher({ token: 't-token' });
    vi.mocked(socket.connectTeacher).mockImplementation(() => fakeConnection());
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('UT-UI-DASH-01 GET /sessions/current 回 404 → 顯示 btn-create-session', async () => {
    vi.mocked(api.getCurrentSession).mockRejectedValue(appError('SESSION_NOT_FOUND'));
    renderDashboard();
    expect(await screen.findByTestId('btn-create-session')).toBeInTheDocument();
    expect(api.getCurrentSession).toHaveBeenCalledWith('t-token');
    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });

  it('UT-UI-DASH-02 GET /sessions/current 回 200 → 不存在 btn-create-session', async () => {
    vi.mocked(api.getCurrentSession).mockResolvedValue(makeTeacherView());
    renderDashboard();
    expect(await screen.findByTestId('room-code', undefined, { timeout: 3000 })).toHaveTextContent('K7Q2MX');
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('準備中');
    expect(screen.getByTestId('team-member-count-1')).toHaveTextContent('2');
    expect(screen.queryByTestId('btn-create-session')).not.toBeInTheDocument();
    expect(socket.connectTeacher).toHaveBeenCalledWith('t-token', 'sess-1');
  });

  it('UT-UI-DASH-03 按 teacher-logout → 呼叫 clearTeacher、導向 /teacher/login、api 未被呼叫', async () => {
    vi.mocked(api.getCurrentSession).mockResolvedValue(makeTeacherView());
    renderDashboard();
    await screen.findByTestId('room-code');
    vi.mocked(api.getCurrentSession).mockClear();

    await userEvent.click(screen.getByTestId('teacher-logout'));

    expect(storage.clearTeacher).toHaveBeenCalled();
    expect(storage.loadTeacher()).toBeNull();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/login'));
    for (const fn of Object.values(api)) {
      if (vi.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled();
    }
  });
});
