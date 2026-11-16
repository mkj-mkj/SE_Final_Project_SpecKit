// 學生頁頂部：組名、自己的暱稱、組員（TECH_SPEC §10.4）
import type { TeamView } from '@quiz/shared';

interface Props {
  team: TeamView['team'];
  me: { id: string; nickname: string };
}

export default function TeamHeader({ team, me }: Props) {
  const members = [...team.members].sort((a, b) => a.nickname.localeCompare(b.nickname, 'zh-Hant'));
  return (
    <header className="team-header">
      <span data-testid="team-name">{team.name}</span>
      {' · '}
      <span data-testid="my-nickname">{me.nickname}</span>
      {' · 組員：'}
      <span data-testid="team-members">
        {members.map((m) => (
          <span key={m.id} className={m.online ? 'member online' : 'member offline'}>
            {m.online ? '●' : '○'}{m.nickname}{' '}
          </span>
        ))}
      </span>
    </header>
  );
}
