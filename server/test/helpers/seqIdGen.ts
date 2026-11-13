// 可預測的 ID 產生器（TEST_SPEC §3）
import type { IdGen } from '../../src/ports/ids.js';

export class SeqIdGen implements IdGen {
  private n = 0;
  private roomIndex = 0;
  constructor(private roomCodes?: string[]) {}

  id(prefix: 'ses' | 'q' | 'slot' | 'team' | 'mem' | 'sub'): string {
    return `${prefix}_${++this.n}`;
  }
  token(): string {
    return `tok_${++this.n}`;
  }
  /** 有指定陣列時依序回傳；否則預設 'AAAAA2','AAAAA3',…（只用 ROOM_CODE_ALPHABET 的字元） */
  roomCode(): string {
    const i = this.roomIndex++;
    if (this.roomCodes) {
      const code = this.roomCodes[i];
      if (code === undefined) throw new Error(`SeqIdGen: roomCodes 已用完（第 ${i + 1} 次）`);
      return code;
    }
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    return 'AAAAA' + alphabet[i % alphabet.length];
  }
}
