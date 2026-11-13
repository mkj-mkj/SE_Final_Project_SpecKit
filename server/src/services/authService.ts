// 老師身分驗證（TECH_SPEC §7.10）。teacher token 只存在記憶體，伺服器重啟即失效。
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@quiz/shared';
import type { IdGen } from '../ports/ids.js';

export class AuthService {
  private readonly password: Buffer;
  private readonly teacherTokens = new Set<string>();

  constructor(
    password: string,
    private readonly ids: IdGen,
  ) {
    this.password = Buffer.from(password, 'utf8');
  }

  /** 密碼正確 → 發出新的 teacher token；錯誤 → UNAUTHORIZED */
  login(password: string): string {
    const given = Buffer.from(password, 'utf8');
    // 長度不同時直接失敗；長度相同才用固定時間比較，避免以回應時間猜出密碼
    if (given.length !== this.password.length || !timingSafeEqual(given, this.password)) {
      throw new AppError('UNAUTHORIZED');
    }
    const token = this.ids.token();
    this.teacherTokens.add(token);
    return token;
  }

  /** token 不在記憶體清單中 → UNAUTHORIZED */
  verifyTeacher(token: string | undefined): void {
    if (token === undefined || !this.teacherTokens.has(token)) {
      throw new AppError('UNAUTHORIZED');
    }
  }
}
