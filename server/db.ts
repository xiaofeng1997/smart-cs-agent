import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: SqlJsDatabase;

// 初始化数据库
export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // 如果数据库文件存在，读取它
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON');

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      sdk_session_id TEXT,
      intent TEXT,
      is_transferred INTEGER DEFAULT 0,
      satisfaction_score INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      tool_calls TEXT,
      intent TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // 满意度评价表
  db.run(`
    CREATE TABLE IF NOT EXISTS satisfaction_ratings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // 转人工记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS transfer_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      reason TEXT,
      intent TEXT,
      transferred_at TEXT NOT NULL,
      resolved_at TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_satisfaction_session ON satisfaction_ratings(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transfer_session ON transfer_records(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_intent ON sessions(intent)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at)');

  // 保存数据库
  saveDatabase();

  console.log('[DB] Database initialized successfully');
}

// 保存数据库到文件
function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// 类型定义
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  intent: string | null;
  is_transferred: number;
  satisfaction_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
  intent: string | null;
}

export interface SatisfactionRating {
  id: string;
  session_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface TransferRecord {
  id: string;
  session_id: string;
  reason: string | null;
  intent: string | null;
  transferred_at: string;
  resolved_at: string | null;
  status: 'pending' | 'resolved' | 'cancelled';
}

// ============= 会话操作 =============

export function getAllSessions(): DbSession[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  const results: DbSession[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as unknown as DbSession);
  }
  stmt.free();
  return results;
}

export function getSession(id: string): DbSession | undefined {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  stmt.bind([id]);
  let result: DbSession | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as DbSession;
  }
  stmt.free();
  return result;
}

export function createSession(session: DbSession): DbSession {
  db.run(
    `INSERT INTO sessions (id, title, model, sdk_session_id, intent, is_transferred, satisfaction_score, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.title, session.model, session.sdk_session_id, session.intent, session.is_transferred, session.satisfaction_score, session.created_at, session.updated_at]
  );
  saveDatabase();
  return session;
}

export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id' | 'intent' | 'is_transferred' | 'satisfaction_score'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push('sdk_session_id = ?');
    values.push(updates.sdk_session_id);
  }
  if (updates.intent !== undefined) {
    fields.push('intent = ?');
    values.push(updates.intent);
  }
  if (updates.is_transferred !== undefined) {
    fields.push('is_transferred = ?');
    values.push(updates.is_transferred);
  }
  if (updates.satisfaction_score !== undefined) {
    fields.push('satisfaction_score = ?');
    values.push(updates.satisfaction_score);
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.run(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return true;
}

export function deleteSession(id: string): boolean {
  db.run('DELETE FROM sessions WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// ============= 消息操作 =============

export function getMessagesBySession(sessionId: string): DbMessage[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  stmt.bind([sessionId]);
  const results: DbMessage[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as unknown as DbMessage);
  }
  stmt.free();
  return results;
}

export function createMessage(message: DbMessage): DbMessage {
  db.run(
    `INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls, intent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [message.id, message.session_id, message.role, message.content, message.model, message.created_at, message.tool_calls, message.intent]
  );

  // 更新会话的 updated_at
  db.run('UPDATE sessions SET updated_at = ? WHERE id = ?', [new Date().toISOString(), message.session_id]);
  saveDatabase();
  return message;
}

export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls' | 'intent'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push('tool_calls = ?');
    values.push(updates.tool_calls);
  }
  if (updates.intent !== undefined) {
    fields.push('intent = ?');
    values.push(updates.intent);
  }

  if (fields.length === 0) return false;

  values.push(id);

  db.run(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return true;
}

export function deleteMessage(id: string): boolean {
  db.run('DELETE FROM messages WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

// ============= 满意度评价操作 =============

export function createSatisfactionRating(rating: SatisfactionRating): SatisfactionRating {
  db.run(
    `INSERT INTO satisfaction_ratings (id, session_id, score, comment, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [rating.id, rating.session_id, rating.score, rating.comment, rating.created_at]
  );

  // 同时更新会话的满意度分数
  db.run('UPDATE sessions SET satisfaction_score = ? WHERE id = ?', [rating.score, rating.session_id]);
  saveDatabase();
  return rating;
}

export function getSatisfactionBySession(sessionId: string): SatisfactionRating | undefined {
  const stmt = db.prepare('SELECT * FROM satisfaction_ratings WHERE session_id = ?');
  stmt.bind([sessionId]);
  let result: SatisfactionRating | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as SatisfactionRating;
  }
  stmt.free();
  return result;
}

export function getAllSatisfactionRatings(): SatisfactionRating[] {
  const stmt = db.prepare('SELECT * FROM satisfaction_ratings ORDER BY created_at DESC');
  const results: SatisfactionRating[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as unknown as SatisfactionRating);
  }
  stmt.free();
  return results;
}

// ============= 转人工记录操作 =============

export function createTransferRecord(record: TransferRecord): TransferRecord {
  db.run(
    `INSERT INTO transfer_records (id, session_id, reason, intent, transferred_at, resolved_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.session_id, record.reason, record.intent, record.transferred_at, record.resolved_at, record.status]
  );

  // 更新会话的转人工状态
  db.run('UPDATE sessions SET is_transferred = 1 WHERE id = ?', [record.session_id]);
  saveDatabase();
  return record;
}

export function updateTransferRecord(id: string, updates: Partial<Pick<TransferRecord, 'resolved_at' | 'status'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.resolved_at !== undefined) {
    fields.push('resolved_at = ?');
    values.push(updates.resolved_at);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (fields.length === 0) return false;

  values.push(id);

  db.run(`UPDATE transfer_records SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return true;
}

export function getTransferRecords(): TransferRecord[] {
  const stmt = db.prepare('SELECT * FROM transfer_records ORDER BY transferred_at DESC');
  const results: TransferRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as unknown as TransferRecord);
  }
  stmt.free();
  return results;
}

export function getTransferBySession(sessionId: string): TransferRecord | undefined {
  const stmt = db.prepare('SELECT * FROM transfer_records WHERE session_id = ?');
  stmt.bind([sessionId]);
  let result: TransferRecord | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as TransferRecord;
  }
  stmt.free();
  return result;
}

// ============= 统计查询 =============

export interface DashboardStats {
  totalSessions: number;
  totalMessages: number;
  transferredSessions: number;
  averageSatisfaction: number;
  intentDistribution: Record<string, number>;
  satisfactionDistribution: Record<number, number>;
  dailySessions: Array<{ date: string; count: number }>;
}

export function getDashboardStats(): DashboardStats {
  // 总会话数
  let stmt = db.prepare('SELECT COUNT(*) as count FROM sessions');
  stmt.step();
  const totalSessions = (stmt.getAsObject() as any).count;
  stmt.free();

  // 总消息数
  stmt = db.prepare('SELECT COUNT(*) as count FROM messages');
  stmt.step();
  const totalMessages = (stmt.getAsObject() as any).count;
  stmt.free();

  // 转人工会话数
  stmt = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_transferred = 1');
  stmt.step();
  const transferredSessions = (stmt.getAsObject() as any).count;
  stmt.free();

  // 平均满意度
  stmt = db.prepare('SELECT AVG(score) as avg_score FROM satisfaction_ratings');
  stmt.step();
  const avgResult = stmt.getAsObject() as any;
  const averageSatisfaction = avgResult.avg_score || 0;
  stmt.free();

  // 意图分布
  const intentDistribution: Record<string, number> = {};
  stmt = db.prepare('SELECT intent, COUNT(*) as count FROM sessions WHERE intent IS NOT NULL GROUP BY intent');
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    intentDistribution[row.intent] = row.count;
  }
  stmt.free();

  // 满意度分布
  const satisfactionDistribution: Record<number, number> = {};
  stmt = db.prepare('SELECT score, COUNT(*) as count FROM satisfaction_ratings GROUP BY score');
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    satisfactionDistribution[row.score] = row.count;
  }
  stmt.free();

  // 每日会话数（最近30天）
  const dailySessions: Array<{ date: string; count: number }> = [];
  stmt = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM sessions
    WHERE created_at >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    dailySessions.push({ date: row.date, count: row.count });
  }
  stmt.free();

  return {
    totalSessions,
    totalMessages,
    transferredSessions,
    averageSatisfaction: Math.round(averageSatisfaction * 100) / 100,
    intentDistribution,
    satisfactionDistribution,
    dailySessions
  };
}

// 清空所有数据
export function clearAllData(): void {
  db.run('DELETE FROM messages');
  db.run('DELETE FROM satisfaction_ratings');
  db.run('DELETE FROM transfer_records');
  db.run('DELETE FROM sessions');
  saveDatabase();
}

export default db;
