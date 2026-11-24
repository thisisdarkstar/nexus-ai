import type { DocumentChunk } from './documentChunker';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
]);

/**
 * Tokenizes text into normalized search terms. Preserves cyber identifiers like IP addresses,
 * CVEs, URLs, and function names.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\d_.:/-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export interface SearchResult extends DocumentChunk {
  score: number;
}

/**
 * Pure client-side, zero-dependency BM25 information retrieval engine.
 * Ranks document chunks against user queries with exact match and term-frequency weighting.
 */
export class SimpleVectorSearch {
  private k1: number = 1.2;
  private b: number = 0.75;

  /**
   * Search a list of document chunks and return the top-K most relevant chunks.
   */
  public search(query: string, chunks: DocumentChunk[], topK: number = 4): SearchResult[] {
    if (!query.trim() || chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const N = chunks.length;

    // Tokenize each chunk and calculate doc lengths
    const chunkTokensMap: Array<{ chunk: DocumentChunk; tokens: string[]; len: number }> = [];
    let totalLen = 0;

    for (const chunk of chunks) {
      const tokens = tokenize(chunk.text);
      const len = tokens.length || 1;
      totalLen += len;
      chunkTokensMap.push({ chunk, tokens, len });
    }

    const avgDocLength = totalLen / N;

    // Calculate document frequencies (DF) for each query token
    const dfMap: Record<string, number> = {};
    for (const qt of queryTokens) {
      let count = 0;
      for (const item of chunkTokensMap) {
        if (item.tokens.includes(qt)) {
          count++;
        }
      }
      dfMap[qt] = count;
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();

    for (const item of chunkTokensMap) {
      let score = 0;

      // Count term frequencies within chunk
      const tfMap: Record<string, number> = {};
      for (const t of item.tokens) {
        tfMap[t] = (tfMap[t] || 0) + 1;
      }

      for (const qt of queryTokens) {
        const tf = tfMap[qt] || 0;
        if (tf === 0) continue;

        const df = dfMap[qt] || 0;
        // BM25 IDF
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        // BM25 TF normalization
        const num = tf * (this.k1 + 1);
        const den = tf + this.k1 * (1 - this.b + this.b * (item.len / avgDocLength));
        score += idf * (num / den);
      }

      // Exact phrase match bonus
      if (lowerQuery.length > 4 && item.chunk.text.toLowerCase().includes(lowerQuery)) {
        score += 3.0;
      }

      // Title/Filename match bonus
      for (const qt of queryTokens) {
        if (item.chunk.docName.toLowerCase().includes(qt)) {
          score += 1.5;
        }
      }

      if (score > 0.05) {
        results.push({
          ...item.chunk,
          score: Math.round(score * 100) / 100,
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }
}

export const simpleVectorSearch = new SimpleVectorSearch();
