import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let poolConfig;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
  const dbUrl = process.env.DATABASE_URL.trim();
  if (dbUrl.includes('@') && dbUrl.includes('://')) {
    poolConfig = {
      connectionString: dbUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    };
  } else {
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'valentines',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    };
  }
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'valentines',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
}

if (poolConfig.password !== undefined && typeof poolConfig.password !== 'string') {
  poolConfig.password = String(poolConfig.password);
}

const pool = new Pool(poolConfig);
pool.on('error', (err) => console.error('Database pool error:', err));

export async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signage_instances (
        id VARCHAR(50) PRIMARY KEY,
        location_name VARCHAR(255) NOT NULL,
        qr_code_url TEXT,
        is_active BOOLEAN DEFAULT true,
        background_config JSONB DEFAULT '{"type": "gradient", "colors": ["#be185d", "#831843", "#500724"]}',
        timezone VARCHAR(50) DEFAULT 'UTC',
        logo_url TEXT,
        text_config JSONB DEFAULT '{}',
        google_sheet_id TEXT,
        google_sheet_tab VARCHAR(100) DEFAULT 'Sheet1',
        questionnaire_config JSONB DEFAULT '{"initial_options": [{"id": "he", "label": "He"}, {"id": "she", "label": "She"}], "questions_by_gender": {"he": [{"id": "q1_he", "label": "How did you meet?", "type": "mcq", "options": [{"label": "At work", "points": 1}, {"label": "Online", "points": 2}, {"label": "Through friends", "points": 3}, {"label": "Other", "points": 4}], "timer_seconds": 10}, {"id": "q2_he", "label": "Favorite date idea?", "type": "mcq", "options": [{"label": "Dinner", "points": 1}, {"label": "Movie", "points": 2}, {"label": "Adventure", "points": 3}, {"label": "Stay home", "points": 4}], "timer_seconds": 10}], "she": [{"id": "q1_she", "label": "How did you meet?", "type": "mcq", "options": [{"label": "At work", "points": 1}, {"label": "Online", "points": 2}, {"label": "Through friends", "points": 3}, {"label": "Other", "points": 4}], "timer_seconds": 10}, {"id": "q2_she", "label": "Favorite date idea?", "type": "mcq", "options": [{"label": "Dinner", "points": 1}, {"label": "Movie", "points": 2}, {"label": "Adventure", "points": 3}, {"label": "Stay home", "points": 4}], "timer_seconds": 10}]}, "result_bands": [{"min_score": 0, "max_score": 4, "signage": {"emoji": "😢", "message": "Keep trying!", "subtext": "Your love story is just beginning"}, "mobile": {"heading": "Keep trying!", "message": "Your love story is just beginning"}}, {"min_score": 5, "max_score": 8, "signage": {"emoji": "💕", "message": "Sweet!", "subtext": "A nice match"}, "mobile": {"heading": "Sweet!", "message": "A nice match"}}, {"min_score": 9, "max_score": 12, "signage": {"emoji": "💖", "message": "Perfect match!", "subtext": "You''re meant to be!"}, "mobile": {"heading": "Perfect match!", "message": "You''re meant to be!"}}]}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        gender VARCHAR(50),
        email_normalized VARCHAR(255),
        phone_normalized VARCHAR(50),
        partner_name VARCHAR(255),
        partner_email VARCHAR(255),
        partner_phone VARCHAR(50),
        partner_gender VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        signage_id VARCHAR(50) REFERENCES signage_instances(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questionnaire_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        signage_id VARCHAR(50) REFERENCES signage_instances(id),
        questionnaire_answers JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'submitted'
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_config (
        signage_id VARCHAR(50) PRIMARY KEY REFERENCES signage_instances(id),
        allow_multiple_submissions BOOLEAN DEFAULT false,
        max_submissions_per_email INTEGER DEFAULT 1,
        max_submissions_per_phone INTEGER DEFAULT 1,
        time_window_hours INTEGER DEFAULT NULL,
        check_signage_ids TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS instance_admin_credentials (
        signage_id VARCHAR(50) PRIMARY KEY REFERENCES signage_instances(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_signage_id ON users(signage_id);
      CREATE INDEX IF NOT EXISTS idx_users_timestamp ON users(timestamp);
      CREATE INDEX IF NOT EXISTS idx_users_email_normalized ON users(email_normalized, signage_id);
      CREATE INDEX IF NOT EXISTS idx_users_phone_normalized ON users(phone_normalized, signage_id);
      CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_signage_id ON questionnaire_sessions(signage_id);
      CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_status ON questionnaire_sessions(status);
    `);

    const signageCheck = await pool.query('SELECT COUNT(*) FROM signage_instances');
    if (parseInt(signageCheck.rows[0].count) === 0) {
      const defaultTextConfig = JSON.stringify({
        idleHeading: "Valentine's Questionnaire",
        idleSubtitle: 'Scan to share your love story',
        sessionActiveMessage: 'Session in progress — use your phone',
        footerText: 'Use your phone camera to scan',
        resultMobileHeading: 'Thank You!',
        resultMobileMessage: 'Your response has been submitted.',
        resultMobileEmoji: '💕'
      });
      await pool.query(`
        INSERT INTO signage_instances (id, location_name, is_active, text_config)
        VALUES ('DEFAULT', 'Valentine''s Event', true, $1::jsonb)
      `, [defaultTextConfig]);
      await pool.query(`
        INSERT INTO validation_config (signage_id, allow_multiple_submissions, max_submissions_per_email)
        VALUES ('DEFAULT', false, 1)
      `);
    }

    return pool;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export { pool };
