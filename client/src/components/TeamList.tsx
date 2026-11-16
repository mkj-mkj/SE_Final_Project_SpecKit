// 老師端：各組成員與上線狀態（TECH_SPEC §10.4）
import type { TeacherView } from '@quiz/shared';

export default function TeamList({ teams }: { teams: TeacherView['teams'] }) {
  return (
    <ul className="team-list">
      {teams.map((t) => (
        <li key={t.id} data-testid={`team-row-${t.index}`} className="team-row">
          <strong>{t.name}</strong>
          {' '}(<span data-testid={`team-member-count-${t.index}`}>{t.members.length}</span> 人)
          {t.members.length === 0 ? (
            <span className="team-empty"> （無人）</span>
          ) : (
            <span className="team-members">
              {t.members.map((m) => (
                <span
                  key={m.id}
                  className={m.online ? 'member online' : 'member offline'}
                  title={m.online ? '上線' : '離線'}
                >
                  {' '}{m.online ? '●' : '○'}{m.nickname}
                </span>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
