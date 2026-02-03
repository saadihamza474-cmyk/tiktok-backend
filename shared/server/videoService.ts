import fetch from 'node-fetch';
import type { VideoRow } from '../shared/schema';
import { getAllVideos } from '../shared/schema';

export interface AppVideo {
  id: string;
  videoUrl: string;
  description: string;
  username: string;
  likesCount: number;
  sharesCount: number;
}

// Categories for randomized topics
const TOPIC_CATEGORIES = ['nature', 'technology', 'people', 'street', 'art'];

// Pexels / Pixabay config (prefer Pexels if API key present)
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';

// Simple in-memory cursor for external API pagination
let externalPage = 1;

function pickRandomCategory(): string {
  const idx = Math.floor(Math.random() * TOPIC_CATEGORIES.length);
  return TOPIC_CATEGORIES[idx];
}

// Map our DB rows to the shape used by the frontend
function mapDbRowToAppVideo(row: VideoRow): AppVideo {
  return {
    id: String(row.id),
    videoUrl: row.video_url,
    description: row.description,
    username: row.username,
    likesCount: row.likes_count,
    sharesCount: row.shares_count,
  };
}

// Map a single Pexels video object into AppVideo
function mapPexelsVideoToAppVideo(v: any): AppVideo | null {
  if (!v || !Array.isArray(v.video_files)) return null;
  // Prefer vertical videos
  const vertical = v.video_files
    .filter((f: any) => f.height > f.width && /mp4/i.test(f.file_type || ''))
    .sort((a: any, b: any) => a.height - b.height);
  const chosen = vertical[0] || v.video_files[0];
  if (!chosen) return null;

  const url: string = chosen.link || chosen.file;
  if (!url) return null;

  const userName = (v.user && (v.user.name || v.user.username)) || 'creator';

  return {
    id: String(v.id),
    videoUrl: url,
    description: (v.url || '').split('/videos/')[1] || 'Short video',
    username: userName.toLowerCase().replace(/\s+/g, ''),
    likesCount: Math.floor(100 + Math.random() * 5000),
    sharesCount: Math.floor(10 + Math.random() * 600),
  };
}

// Map a single Pixabay hit into AppVideo
function mapPixabayVideoToAppVideo(hit: any): AppVideo | null {
  if (!hit || !hit.videos) return null;
  const vid = hit.videos.large || hit.videos.medium || hit.videos.small;
  if (!vid || !vid.url) return null;

  const userName = hit.user || 'creator';

  return {
    id: String(hit.id),
    videoUrl: vid.url,
    description: hit.tags || 'Short video',
    username: userName.toLowerCase().replace(/\s+/g, ''),
    likesCount: hit.likes != null ? hit.likes : Math.floor(100 + Math.random() * 5000),
    sharesCount: hit.downloads != null ? hit.downloads : Math.floor(10 + Math.random() * 600),
  };
}

async function fetchFromPexels(page: number, perPage = 10): Promise<AppVideo[]> {
  if (!PEXELS_API_KEY) return [];
  const category = pickRandomCategory();
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(category)}&orientation=portrait&size=small&page=${page}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: {
      Authorization: PEXELS_API_KEY,
    },
  });
  if (!res.ok) throw new Error(`Pexels error: ${res.status}`);
  const data: any = await res.json();
  const videos: any[] = data.videos || [];
  return videos
    .map((v) => mapPexelsVideoToAppVideo(v))
    .filter((v): v is AppVideo => Boolean(v));
}

async function fetchFromPixabay(page: number, perPage = 10): Promise<AppVideo[]> {
  if (!PIXABAY_API_KEY) return [];
  const category = pickRandomCategory();
  const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(category)}&orientation=vertical&page=${page}&per_page=${perPage}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay error: ${res.status}`);
  const data: any = await res.json();
  const hits: any[] = data.hits || [];
  return hits
    .map((h) => mapPixabayVideoToAppVideo(h))
    .filter((v): v is AppVideo => Boolean(v));
}

// Helper: fetch more external short videos (random topics, paginated)
export async function fetchGlobalVideos(): Promise<AppVideo[]> {
  // 1) Try local DB first
  const localRows = await getAllVideos();
  if (localRows && localRows.length > 0) {
    return localRows.map(mapDbRowToAppVideo);
  }

  // 2) Fallback to external APIs (Pexels preferred, then Pixabay)
  const page = externalPage++;

  // Try Pexels
  try {
    const pexelsVideos = await fetchFromPexels(page, 10);
    if (pexelsVideos.length) return pexelsVideos;
  } catch (err) {
    console.error('Pexels fetch failed, trying Pixabay', err);
  }

  // Try Pixabay
  try {
    const pixabayVideos = await fetchFromPixabay(page, 10);
    if (pixabayVideos.length) return pixabayVideos;
  } catch (err) {
    console.error('Pixabay fetch failed', err);
  }

  // 3) Absolute fallback: empty list, frontend will still use its own defaults
  return [];
}

// Helper for infinite pagination: always external, DB already handled in fetchGlobalVideos
export async function fetchMoreExternalVideos(): Promise<AppVideo[]> {
  const page = externalPage++;

  // Try Pexels first
  try {
    const pexels = await fetchFromPexels(page, 10);
    if (pexels.length) return pexels;
  } catch (err) {
    console.error('Pexels fetchMoreExternalVideos error', err);
  }

  // Fallback to Pixabay
  try {
    const pixabay = await fetchFromPixabay(page, 10);
    if (pixabay.length) return pixabay;
  } catch (err) {
    console.error('Pixabay fetchMoreExternalVideos error', err);
  }

  return [];
}
