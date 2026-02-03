import type { Express, Request, Response } from 'express';
import { getAllVideos } from '../shared/schema';
import { fetchGlobalVideos, fetchMoreExternalVideos } from './videoService';

export function registerRoutes(app: Express) {
  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Legacy endpoint: directly from local DB (kept for compatibility)
  app.get('/api/videos', async (_req: Request, res: Response) => {
    try {
      const rows = await getAllVideos();
      const payload = rows.map((row) => ({
        id: row.id,
        videoUrl: row.video_url,
        description: row.description,
        username: row.username,
        likesCount: row.likes_count,
        sharesCount: row.shares_count,
      }));
      res.json(payload);
    } catch (err) {
      console.error('Error fetching videos', err);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  });

  // Main feed endpoint with fallback to Pexels / Pixabay
  app.get('/api/feed', async (_req: Request, res: Response) => {
    try {
      const videos = await fetchGlobalVideos();
      res.json({ videos });
    } catch (err) {
      console.error('Error in /api/feed', err);
      res.status(500).json({ error: 'Failed to load global feed' });
    }
  });

  // Infinite pagination endpoint – always fetches more external videos
  app.get('/api/feed/next', async (_req: Request, res: Response) => {
    try {
      const videos = await fetchMoreExternalVideos();
      res.json({ videos });
    } catch (err) {
      console.error('Error in /api/feed/next', err);
      res.status(500).json({ error: 'Failed to load next page' });
    }
  });
}
