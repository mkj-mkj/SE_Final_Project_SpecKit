import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp, TEACHER_PASSWORD } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

describe('身分驗證整合測試', () => {
  let t: App;
  beforeEach(async () => {
    t = await startApp();
  });
  afterEach(async () => {
    await t.close();
  });

  /** 老師登入並建立活動，再讓一位學生加入；回傳兩種 token */
  async function seed() {
    const login = await request(t.app).post('/api/teacher/login').send({ password: TEACHER_PASSWORD }).expect(200);
    const teacherToken = login.body.token as string;
    const created = await request(t.app)
      .post('/api/teacher/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({})
      .expect(201);
    const joined = await request(t.app)
      .post(`/api/public/sessions/${created.body.session.roomCode}/join`)
      .send({ teamId: created.body.teams[0].id, nickname: '小明' })
      .expect(201);
    return { teacherToken, memberToken: joined.body.token as string, sessionId: created.body.session.id as string };
  }

  it('IT-AUTH-01 不帶 token 呼叫老師 API → 401，本文為 { error: { code: UNAUTHORIZED, message } }', async () => {
    for (const req of [
      request(t.app).post('/api/teacher/sessions').send({}),
      request(t.app).get('/api/teacher/sessions/current'),
      request(t.app).patch('/api/teacher/sessions/ses_1/settings').send({ teamCount: 4 }),
    ]) {
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: '驗證失敗，請重新登入或加入' } });
    }
  });

  it('IT-AUTH-02 學生 token 呼叫老師 API → 401；老師 token 呼叫 GET /api/play/state → 401', async () => {
    const { teacherToken, memberToken, sessionId } = await seed();

    const asMember = await request(t.app)
      .get(`/api/teacher/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(asMember.status).toBe(401);
    expect(asMember.body.error.code).toBe('UNAUTHORIZED');

    const asTeacher = await request(t.app).get('/api/play/state').set('Authorization', `Bearer ${teacherToken}`);
    expect(asTeacher.status).toBe(401);
    expect(asTeacher.body.error.code).toBe('UNAUTHORIZED');

    // 對照組：各自用正確的身分可以通過
    await request(t.app).get(`/api/teacher/sessions/${sessionId}`).set('Authorization', `Bearer ${teacherToken}`).expect(200);
    await request(t.app).get('/api/play/state').set('Authorization', `Bearer ${memberToken}`).expect(200);
  });

  it('IT-AUTH-03 Socket 以錯誤 token 連線 → connect_error.message === UNAUTHORIZED', async () => {
    const { teacherToken } = await seed();
    const cases: Record<string, string>[] = [
      { token: 'tok_wrong' }, // 不存在的 token
      { token: teacherToken }, // 老師 token 但沒帶 sessionId
      { token: teacherToken, sessionId: 'ses_nope' }, // 活動不存在
    ];
    for (const auth of cases) {
      const socket = t.connect(auth);
      const message = await new Promise<string>((resolve) => socket.once('connect_error', (e) => resolve(e.message)));
      expect(message, JSON.stringify(auth)).toBe('UNAUTHORIZED');
    }
  });
});
