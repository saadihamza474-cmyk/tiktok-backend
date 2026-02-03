import { Pool } from 'pg';

// Example: initialize a pooled client (in real app, share this across modules)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Database schema description for reference / migration tooling
// videos table definition
//
// CREATE TABLE IF NOT EXISTS videos (
//   id SERIAL PRIMARY KEY,
//   video_url TEXT NOT NULL,
//   description TEXT NOT NULL,
//   username VARCHAR(255) NOT NULL,
//   likes_count INTEGER NOT NULL DEFAULT 0,
//   shares_count INTEGER NOT NULL DEFAULT 0,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export interface VideoRow {
  id: number;
  video_url: string;
  description: string;
  username: string;
  likes_count: number;
  shares_count: number;
  created_at: Date;
}

export async function getAllVideos(): Promise<VideoRow[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<VideoRow>(
      'SELECT id, video_url, description, username, likes_count, shares_count, created_at FROM videos ORDER BY id DESC'
    );
    return res.rows;
  } finally {
    client.release();
  }
}
