import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../src/api';
import * as storage from '../../src/storage';
import Join from '../../src/pages/Join';
import { LocationProbe } from '../helpers/LocationProbe';
import { appError, makePlayState } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage')>();
  return { ...actual, clearMember: vi.fn(actual.clearMember) };
});

function renderJoinPage(entry = '/join') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/join" element={<Join />} />
        <Route path="/play" element={<div>play page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Join', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.clearAllMocks());

  it('UT-UI-JOIN-05 有 member token 且 GET /state 回 200 → 導向 /play，不顯示 JoinForm', async () => {
    storage.saveMember({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm1' });
    vi.mocked(api.getPlayState).mockResolvedValue(makePlayState());
    renderJoinPage();
    expect(screen.queryByTestId('join-room')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/play'));
    expect(api.getPlayState).toHaveBeenCalledWith('m-token');
    expect(screen.queryByTestId('join-room')).not.toBeInTheDocument();
  });

  it('UT-UI-JOIN-06 有 member token 且 GET /state 回 401 → clearMember；join-room 預填原 roomCode', async () => {
    storage.saveMember({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm1' });
    vi.mocked(api.getPlayState).mockRejectedValue(appError('UNAUTHORIZED'));
    renderJoinPage('/join?room=ZZZZZZ');
    expect(await screen.findByTestId('join-room')).toHaveValue('K7Q2MX');
    expect(storage.clearMember).toHaveBeenCalled();
    expect(storage.loadMember()).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/join');
  });
});
