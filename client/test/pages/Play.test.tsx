import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../src/api';
import * as socket from '../../src/socket';
import * as storage from '../../src/storage';
import Play from '../../src/pages/Play';
import { LocationProbe } from '../helpers/LocationProbe';
import { appError, fakeConnection } from '../helpers/fixtures';

vi.mock('../../src/api');
vi.mock('../../src/socket');
vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage')>();
  return { ...actual, clearMember: vi.fn(actual.clearMember) };
});

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/play']}>
      <Routes>
        <Route path="/play" element={<Play />} />
        <Route path="/join" element={<div>join page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Play', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(socket.connectMember).mockImplementation(() => fakeConnection());
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('UT-UI-PLAY-01 無 member token → 導向 /join', async () => {
    renderPlay();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/join$/));
    expect(api.getPlayState).not.toHaveBeenCalled();
  });

  it('UT-UI-PLAY-02 GET /state 回 401 → clearMember 並導向 /join?room=<roomCode>', async () => {
    storage.saveMember({ token: 'm-token', roomCode: 'K7Q2MX', memberId: 'm1' });
    vi.mocked(api.getPlayState).mockRejectedValue(appError('UNAUTHORIZED'));
    renderPlay();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/join?room=K7Q2MX'));
    expect(api.getPlayState).toHaveBeenCalledWith('m-token');
    expect(storage.clearMember).toHaveBeenCalled();
    expect(storage.loadMember()).toBeNull();
  });
});
