// ============================================
// Ingestion Pipeline Services
// ============================================

// --- Text Chunker ---
export interface ChunkResult {
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Split text into overlapping chunks for embedding
 */
export function chunkText(
  text: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    sourceMeta?: Record<string, unknown>;
  } = {}
): ChunkResult[] {
  const { chunkSize = 1000, chunkOverlap = 200, sourceMeta = {} } = options;

  // Clean the text first
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText || cleanedText.length < 50) return [];

  const chunks: ChunkResult[] = [];
  let start = 0;

  while (start < cleanedText.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < cleanedText.length) {
      const lastSentence = cleanedText.lastIndexOf('.', end);
      const lastNewline = cleanedText.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastSentence, lastNewline);

      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    } else {
      end = cleanedText.length;
    }

    const chunkContent = cleanedText.slice(start, end).trim();

    if (chunkContent.length >= 50) {
      chunks.push({
        content: chunkContent,
        metadata: {
          ...sourceMeta,
          char_offset: start,
          chunk_index: chunks.length,
        },
      });
    }

    start = end - chunkOverlap;
    if (start >= cleanedText.length) break;
  }

  return chunks;
}

// --- Website Crawler ---
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { logger } from '../../utils/logger.js';

interface CrawlResult {
  url: string;
  title: string;
  text: string;
}

/**
 * Crawl a website: extract text from HTML, follow internal links
 */
export async function crawlWebsite(
  baseUrl: string,
  options: { crawlDepth?: number; pageLimit?: number } = {}
): Promise<CrawlResult[]> {
  const { crawlDepth = 3, pageLimit = 50 } = options;
  const visited = new Set<string>();
  const results: CrawlResult[] = [];
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.hostname;

  // Check robots.txt
  let robots: any = null;
  try {
    const robotsUrl = `${baseUrlObj.protocol}//${baseDomain}/robots.txt`;
    const robotsResponse = await fetch(robotsUrl);
    if (robotsResponse.ok) {
      const robotsTxt = await robotsResponse.text();
      robots = robotsParser(robotsUrl, robotsTxt);
    }
  } catch {
    // robots.txt not found — proceed
  }

  async function crawlPage(url: string, depth: number) {
    if (depth > crawlDepth || results.length >= pageLimit || visited.has(url)) return;
    visited.add(url);

    // Respect robots.txt
    if (robots && !robots.isAllowed(url, 'ChatbotCrawler')) {
      logger.debug(`Blocked by robots.txt: ${url}`);
      return;
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ChatbotCrawler/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove boilerplate elements
      $('script, style, nav, footer, header, aside, .cookie-notice, .popup, iframe, noscript').remove();

      const title = $('title').text().trim();
      const text = $('main, article, .content, #content, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 50) {
        results.push({ url, title, text });
      }

      // Extract internal links for next depth
      if (depth < crawlDepth && results.length < pageLimit) {
        const links: string[] = [];
        $('a[href]').each((_: number, el: any) => {
          try {
            const href = $(el).attr('href');
            if (!href) return;
            const linkUrl = new URL(href, url);
            if (linkUrl.hostname === baseDomain && !visited.has(linkUrl.href)) {
              // Skip anchors, files, and non-page links
              if (linkUrl.pathname.match(/\.(pdf|jpg|png|gif|css|js|zip|mp3|mp4)$/i)) return;
              links.push(linkUrl.href);
            }
          } catch {
            // Invalid URL — skip
          }
        });

        // Crawl child pages
        for (const link of links.slice(0, 20)) {
          if (results.length >= pageLimit) break;
          await crawlPage(link, depth + 1);
        }
      }
    } catch (error) {
      logger.warn(`Crawl failed for ${url}`, { error: String(error) });
    }
  }

  await crawlPage(baseUrl, 0);
  return results;
}

// --- PDF Extractor ---
import pdf from 'pdf-parse';

export async function extractPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text || '';
}

// --- DOCX Extractor ---
import mammoth from 'mammoth';

export async function extractDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

// --- Plain Text ---
export function extractTXT(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

// --- Audio/Video Transcription ---
import OpenAI, { toFile } from 'openai';
import { config } from '../../config/index.js';

export async function transcribeAudio(buffer: Buffer, originalName: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || config.openai.apiKey;
  if (!apiKey) {
    throw new Error('Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured');
  }

  // If we have a Gemini API key, use Gemini for native multimodal transcription
  if (process.env.GEMINI_API_KEY) {
    const ext = originalName.split('.').pop()?.toLowerCase();
    let mimeType = 'audio/mp3';
    if (ext === 'wav') mimeType = 'audio/wav';
    if (ext === 'ogg') mimeType = 'audio/ogg';
    if (ext === 'm4a') mimeType = 'audio/m4a';
    if (ext === 'mp4') mimeType = 'video/mp4';
    if (ext === 'webm') mimeType = 'video/webm';

    const base64Data = buffer.toString('base64');

    const payload = {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            }
          },
          {
            text: 'Please transcribe this file accurately. Write down the transcription of the audio verbatim. Do not add any explanation, metadata, introduction, or notes.'
          }
        ]
      }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json() as any;

    if (!res.ok) {
      console.error('Gemini Transcription Error:', JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || 'Gemini transcription failed');
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Fallback to OpenAI Whisper
  const openai = new OpenAI({ apiKey: config.openai.apiKey });
  const file = await toFile(buffer, originalName);
  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });
  return response.text || '';
}
