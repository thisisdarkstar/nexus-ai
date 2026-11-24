export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  tokenEstimate: number;
}

export interface ChunkOptions {
  chunkSize?: number; // Target character length (default 750)
  overlap?: number;   // Character overlap between chunks (default 120)
}

/**
 * Splits text documents into semantic chunks suitable for offline RAG.
 * Respects Markdown headers, paragraphs, and code blocks to keep context coherent.
 */
export function chunkDocument(
  docId: string,
  docName: string,
  content: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const { chunkSize = 750, overlap = 120 } = options;
  const rawText = content.trim();
  if (!rawText) return [];

  // If text is smaller than chunkSize, return a single chunk
  if (rawText.length <= chunkSize) {
    return [
      {
        id: `${docId}-chunk-0`,
        docId,
        docName,
        chunkIndex: 0,
        totalChunks: 1,
        text: rawText,
        tokenEstimate: estimateTokens(rawText),
      },
    ];
  }

  // Split preferentially by structural boundaries:
  // 1. Double newlines (paragraphs or markdown sections)
  // 2. Single newlines (lines of code or lists)
  // 3. Sentence boundaries (periods followed by space)
  const paragraphs = rawText.split(/\n{2,}/);
  const rawSegments: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= chunkSize) {
      rawSegments.push(para);
    } else {
      // Break large paragraphs by single newlines
      const lines = para.split(/\n/);
      for (const line of lines) {
        if (line.length <= chunkSize) {
          rawSegments.push(line);
        } else {
          // Break very long lines by sentence or hard limit
          let remaining = line;
          while (remaining.length > 0) {
            if (remaining.length <= chunkSize) {
              rawSegments.push(remaining);
              break;
            }
            let cutIdx = remaining.lastIndexOf('. ', chunkSize);
            if (cutIdx === -1 || cutIdx < chunkSize * 0.4) {
              cutIdx = remaining.lastIndexOf(' ', chunkSize);
            }
            if (cutIdx === -1 || cutIdx < chunkSize * 0.3) {
              cutIdx = chunkSize;
            } else {
              cutIdx += 1; // Include period/space
            }
            rawSegments.push(remaining.slice(0, cutIdx).trim());
            remaining = remaining.slice(cutIdx).trim();
          }
        }
      }
    }
  }

  // Now aggregate rawSegments into chunks of target chunkSize with overlap
  const chunks: string[] = [];
  let currentAccumulator: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i].trim();
    if (!seg) continue;

    if (currentLength + seg.length + 1 > chunkSize && currentAccumulator.length > 0) {
      const chunkText = currentAccumulator.join('\n\n');
      chunks.push(chunkText);

      // Create overlap from end of current chunk
      let overlapChars = 0;
      const overlapSegments: string[] = [];
      for (let j = currentAccumulator.length - 1; j >= 0; j--) {
        const s = currentAccumulator[j];
        if (overlapChars + s.length > overlap && overlapSegments.length > 0) break;
        overlapSegments.unshift(s);
        overlapChars += s.length;
      }

      currentAccumulator = [...overlapSegments, seg];
      currentLength = currentAccumulator.reduce((sum, s) => sum + s.length, 0);
    } else {
      currentAccumulator.push(seg);
      currentLength += seg.length + 1;
    }
  }

  if (currentAccumulator.length > 0) {
    const finalChunk = currentAccumulator.join('\n\n').trim();
    if (finalChunk) {
      chunks.push(finalChunk);
    }
  }

  const total = chunks.length;
  return chunks.map((text, idx) => ({
    id: `${docId}-chunk-${idx}`,
    docId,
    docName,
    chunkIndex: idx,
    totalChunks: total,
    text,
    tokenEstimate: estimateTokens(text),
  }));
}

/**
 * Fast token estimation (~3.8 characters per token for English & code)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}
