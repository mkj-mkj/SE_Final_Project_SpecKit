-- 資料庫結構（TECH_SPEC §5，逐字照抄；001 建立全部資料表）
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, room_code TEXT NOT NULL UNIQUE, phase TEXT NOT NULL,
  spreadsheet_id TEXT, sheet_title TEXT,
  fairness_mode TEXT NOT NULL, window_sec INTEGER NOT NULL, team_count INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, started_at INTEGER, ended_at INTEGER,
  import_summary TEXT                    -- JSON
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  number INTEGER NOT NULL, is_group INTEGER NOT NULL, sub_count INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'open', window_ends_at INTEGER,
  UNIQUE(session_id, number)
);
CREATE TABLE IF NOT EXISTS answer_slots (
  id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sub_no INTEGER NOT NULL, sheet_title TEXT NOT NULL, row INTEGER NOT NULL, col INTEGER NOT NULL,
  a1 TEXT NOT NULL, prefix TEXT NOT NULL, original_value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL, name TEXT NOT NULL, UNIQUE(session_id, idx)
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL, nickname_key TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
  joined_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  UNIQUE(team_id, nickname_key)          -- nickname_key = lower(trim(nickname))
);
CREATE TABLE IF NOT EXISTS drafts (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answers TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, question_id)
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  answers TEXT NOT NULL, server_time INTEGER NOT NULL, seq INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL, order_key INTEGER, withdrawn_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sub_q ON submissions(question_id);
-- 每組每題最多一筆 active 或 rejected（FR-08）
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_team_q_live
  ON submissions(team_id, question_id) WHERE status IN ('active','rejected');
