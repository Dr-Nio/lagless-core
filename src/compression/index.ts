export interface Compressor {
  compress(data: string): Promise<string> | string;
  decompress(data: string): Promise<string> | string;
}

export class IdentityCompressor implements Compressor {
  compress(data: string): string {
    return data;
  }
  decompress(data: string): string {
    return data;
  }
}

export class GzipCompressor implements Compressor {
  private useBuiltIn = typeof CompressionStream !== 'undefined';

  async compress(data: string): Promise<string> {
    if (this.useBuiltIn) {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();
      writer.write(encoder.encode(data));
      writer.close();
      const compressed = await new Response(stream.readable).arrayBuffer();
      return btoa(String.fromCharCode(...new Uint8Array(compressed)));
    }
    // Fallback to identity in environments without CompressionStream
    return data;
  }

  async decompress(data: string): Promise<string> {
    if (this.useBuiltIn) {
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const decompressed = await new Response(stream.readable).arrayBuffer();
      return new TextDecoder().decode(decompressed);
    }
    return data;
  }
}

export class CompressionEngine {
  private compressor: Compressor;

  constructor(compressor?: Compressor) {
    this.compressor = compressor ?? new IdentityCompressor();
  }

  setCompressor(compressor: Compressor): void {
    this.compressor = compressor;
  }

  async compress(data: unknown): Promise<string> {
    const jsonString = JSON.stringify(data);
    return this.compressor.compress(jsonString);
  }

  async decompress<T>(compressed: string): Promise<T> {
    const jsonString = await this.compressor.decompress(compressed);
    return JSON.parse(jsonString) as T;
  }

  async compressIfNeeded(data: unknown, threshold = 1024): Promise<{ compressed: string; wasCompressed: boolean }> {
    const jsonString = JSON.stringify(data);
    if (jsonString.length < threshold) {
      return { compressed: jsonString, wasCompressed: false };
    }
    const compressed = await this.compressor.compress(jsonString);
    return { compressed, wasCompressed: true };
  }

  async decompressIfNeeded(data: string, wasCompressed: boolean): Promise<unknown> {
    if (!wasCompressed) {
      return JSON.parse(data);
    }
    return this.decompress(data);
  }
}

export function createDefaultCompressionEngine(): CompressionEngine {
  let compressor: Compressor;
  try {
    // Check if gzip compression is available
    if (typeof CompressionStream !== 'undefined') {
      compressor = new GzipCompressor();
    } else {
      compressor = new IdentityCompressor();
    }
  } catch {
    compressor = new IdentityCompressor();
  }
  return new CompressionEngine(compressor);
}
