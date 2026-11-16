import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../src/api';
import * as storage from '../../src/storage';
import JoinForm from '../../src/components/JoinForm';
import { LocationProbe } from '../helpers/LocationProbe';
import { appError, makePublicInfo } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage')>();
  return { ...actual, saveMember: vi.fn(actual.saveMember) };
});

function renderJoin(initialRoom = '') {
  return render(
    <MemoryRouter initialEntries={['/join']}>
      <Routes>
        <Route path="/join" element={<JoinForm initialRoom={initialRoom} />} />
        <Route path="/play" element={<div>play page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function gotoTeams() {
  await userEvent.type(screen.getByTestId('join-room'), 'k7q2mx');
  await userEvent.click(screen.getByTestId('join-room-next'));
  await screen.findByTestId('join-team-1');
}

describe('JoinForm', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.getPublicInfo).mockResolvedValue(makePublicInfo());
  });
  afterEach(() => vi.clearAllMocks());

  it('UT-UI-JOIN-01 輸入房間碼 → 下一步 → 呼叫 getPublicInfo；顯示各組與人數', async () => {
    renderJoin();
    await gotoTeams();
    expect(api.getPublicInfo).toHaveBeenCalledWith('K7Q2MX');
    expect(screen.getByTestId('join-team-1')).toHaveTextContent('第 1 組');
    expect(screen.getByTestId('join-team-1')).toHaveTextContent('2 人');
    expect(screen.getByTestId('join-team-2')).toHaveTextContent('第 2 組');
    expect(screen.getByTestId('join-team-2')).toHaveTextContent('0 人');
  });

  it('UT-UI-JOIN-02 未選組或暱稱空白 → join-submit disabled', async () => {
    renderJoin();
    await gotoTeams();
    expect(screen.getByTestId('join-submit')).toBeDisabled();

    await userEvent.type(screen.getByTestId('join-nickname'), '小明');
    expect(screen.getByTestId('join-submit')).toBeDisabled(); // 尚未選組

    await userEvent.clear(screen.getByTestId('join-nickname'));
    await userEvent.type(screen.getByTestId('join-nickname'), '   ');
    await userEvent.click(screen.getByTestId('join-team-1'));
    expect(screen.getByTestId('join-submit')).toBeDisabled(); // 暱稱只有空白

    await userEvent.type(screen.getByTestId('join-nickname'), '小明');
    expect(screen.getByTestId('join-submit')).toBeEnabled();
  });

  it('UT-UI-JOIN-03 api 回 NICKNAME_TAKEN → 顯示錯誤，不導頁', async () => {
    vi.mocked(api.join).mockRejectedValue(appError('NICKNAME_TAKEN'));
    renderJoin();
    await gotoTeams();
    await userEvent.click(screen.getByTestId('join-team-1'));
    await userEvent.type(screen.getByTestId('join-nickname'), '小明');
    await userEvent.click(screen.getByTestId('join-submit'));

    expect(await screen.findByTestId('error-banner')).toHaveTextContent('這個暱稱在組內已被使用');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/join$/);
    expect(storage.saveMember).not.toHaveBeenCalled();
  });

  it('UT-UI-JOIN-04 成功 → saveMember 後導向 /play', async () => {
    vi.mocked(api.join).mockResolvedValue({ token: 'm-token', memberId: 'm9', teamId: 't2', sessionId: 'sess-1' });
    renderJoin();
    await gotoTeams();
    await userEvent.click(screen.getByTestId('join-team-2'));
    await userEvent.type(screen.getByTestId('join-nickname'), ' 小明 ');
    await userEvent.click(screen.getByTestId('join-submit'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/play'));
    expect(api.join).toHaveBeenCalledWith('K7Q2MX', { teamId: 't2', nickname: '小明' });
    expect(storage.saveMember).toHaveBeenCalledWith({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm9' });
    expect(storage.loadMember()).toEqual({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm9' });
  });
});
