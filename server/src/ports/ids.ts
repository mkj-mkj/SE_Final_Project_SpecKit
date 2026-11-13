// ID、token、房間碼產生器（TECH_SPEC §7.1）。業務邏輯只能透過 IdGen 取得亂數。
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@quiz/shared';

export interface IdGen {
  id(prefix: 'ses' | 'q' | 'slot' | 'team' | 'mem' | 'sub'): string;
  token(): string;
  roomCode(): string;
}

export const cryptoIdGen: IdGen = {
  id: (prefix) => `${prefix}_${randomUUID()}`,
  token: () => randomBytes(32).toString('hex'), // 32 bytes hex
  roomCode: () => {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
    }
    return code;
  },
};
