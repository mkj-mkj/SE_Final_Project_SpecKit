// 客戶端身分儲存（TECH_SPEC §10.2）；所有讀寫皆 try/catch（無痕模式可能丟例外）

export interface MemberIdentity { token: string; roomCode: string; memberId: string }
export interface TeacherIdentity { token: string }

const MEMBER_KEY = 'quiz.member';
const TEACHER_KEY = 'quiz.teacher';

function getStore(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function remove(kind: 'local' | 'session', key: string): void {
  try {
    getStore(kind)?.removeItem(key);
  } catch {
    // 忽略：無法存取 storage
  }
}

function load<T>(kind: 'local' | 'session', key: string): T | null {
  let raw: string | null;
  try {
    raw = getStore(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    remove(kind, key); // JSON 壞掉 → 清除並回傳 null
    return null;
  }
}

function save(kind: 'local' | 'session', key: string, value: unknown): void {
  try {
    getStore(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略：無法寫入 storage
  }
}

export function loadMember(): MemberIdentity | null {
  return load<MemberIdentity>('local', MEMBER_KEY);
}
export function saveMember(v: MemberIdentity): void {
  save('local', MEMBER_KEY, v);
}
export function clearMember(): void {
  remove('local', MEMBER_KEY);
}

export function loadTeacher(): TeacherIdentity | null {
  return load<TeacherIdentity>('session', TEACHER_KEY);
}
export function saveTeacher(v: TeacherIdentity): void {
  save('session', TEACHER_KEY, v);
}
export function clearTeacher(): void {
  remove('session', TEACHER_KEY);
}
