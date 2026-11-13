import type { TeacherView, TeamView } from '@quiz/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextEvent, startApp, TEACHER_PASSWORD } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

describe('上線狀態整合測試', () => {
  let t: App;
  beforeEach(async () => {
    t = await startApp();
  });
  afterEach(async () => {
    await t.close();
  });

  it('IT-ONLINE-01 同一成員開 2 個 socket：關 1 個仍上線，2 個都關才離線', async () => {
    // 老師登入、建立活動並以 { token, sessionId } 連線
    const { body: login } = await request(t.app).post('/api/teacher/login').send({ password: TEACHER_PASSWORD });
    const { body: view } = await request(t.app)
      .post('/api/teacher/sessions')
      .set('Authorization', `Bearer ${login.token}`)
      .send({ teamCount: 2 })
      .expect(201);
    const sessionId = (view as TeacherView).session.id;
    const [teamA, teamB] = (view as TeacherView).teams;

    const teacher = t.connect({ token: login.token, sessionId });
    let latest = await nextEvent<TeacherView>(teacher, 'teacher:state'); // 連線後立即收到目前狀態
    teacher.on('teacher:state', (s: TeacherView) => {
      latest = s;
    });

    const join = (teamId: string, nickname: string) =>
      request(t.app)
        .post(`/api/public/sessions/${(view as TeacherView).session.roomCode}/join`)
        .send({ teamId, nickname })
        .expect(201)
        .then((r) => r.body as { token: string; memberId: string });
    const amy = await join(teamA!.id, 'Amy');
    await join(teamB!.id, 'SECRETNICKB');

    const onlineOf = (memberId: string) =>
      latest.teams.flatMap((x) => x.members).find((m) => m.id === memberId)?.online;
    const serverSockets = () => t.io.of('/').sockets.size;

    // 同一成員開 2 個分頁
    const tab1 = t.connect({ token: amy.token });
    const firstTeamState = await nextEvent<TeamView>(tab1, 'team:state');
    const tab2 = t.connect({ token: amy.token });
    await nextEvent<TeamView>(tab2, 'team:state');
    await vi.waitFor(() => expect(onlineOf(amy.memberId)).toBe(true));
    // 學生收到的狀態只含本組成員（憲章原則 IV）
    expect(JSON.stringify(firstTeamState)).not.toContain('SECRETNICKB');

    // 關 1 個：等伺服器處理完斷線（連線數減少）後，老師端仍顯示上線
    const before = serverSockets();
    tab1.close();
    await vi.waitFor(() => expect(serverSockets()).toBe(before - 1));
    const { body: afterOne } = await request(t.app)
      .get(`/api/teacher/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${login.token}`)
      .expect(200);
    expect((afterOne as TeacherView).teams[0]!.members.find((m) => m.id === amy.memberId)?.online).toBe(true);
    expect(onlineOf(amy.memberId)).toBe(true);

    // 2 個都關：老師收到的 teacher:state 中該成員 online=false
    tab2.close();
    await vi.waitFor(() => expect(onlineOf(amy.memberId)).toBe(false));
  });
});
