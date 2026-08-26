class RecursiveCharacterTextSplitter {
  constructor(separators = ['\n\n', '\n', '. ', ' ']) {
    this.separators = separators;
  }

  splitText(text, chunkSize = 2000, chunkOverlap = 200) {
    const chunks = [];
    this._splitRecursive(text, chunkSize, chunkOverlap, 0, chunks);
    return chunks.filter((chunk) => chunk.trim().length > 0);
  }

  _splitRecursive(text, chunkSize, chunkOverlap, depth, chunks) {
    if (depth >= this.separators.length) {
      if (text.trim().length > 0) {
        chunks.push(text.trim());
      }
      return;
    }

    const separator = this.separators[depth];
    const splits = separator ? text.split(separator) : [text];

    let currentChunk = '';

    for (let i = 0; i < splits.length; i++) {
      const part = splits[i];
      const separatorStr = separator || '';
      const candidate = currentChunk ? currentChunk + separatorStr + part : part;

      if (candidate.length <= chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = this._getOverlap(currentChunk, chunkOverlap);
        }

        if (part.length > chunkSize) {
          this._splitRecursive(part, chunkSize, chunkOverlap, depth + 1, chunks);
          currentChunk = '';
        } else {
          currentChunk = part;
        }
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
  }

  _getOverlap(text, overlapSize) {
    if (overlapSize <= 0) return '';
    const start = Math.max(0, text.length - overlapSize);
    return text.slice(start);
  }
}

module.exports = RecursiveCharacterTextSplitter;
