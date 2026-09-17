import { Subject, type Observable } from 'rxjs';
import { uid } from '../../shared/utils/id';

export const CHUNK_SIZE = 16 * 1024;
const LOW_WATER_MARK = 256 * 1024;
const HIGH_WATER_MARK = 1024 * 1024;

export interface BlobMeta {
  [key: string]: string | number | boolean;
}

export interface ReceivedBlob {
  id: string;
  blob: Blob;
  meta: BlobMeta;
}

type Header = { kind: 'blob-start'; id: string; size: number; type: string; meta: BlobMeta } | { kind: 'blob-end'; id: string };

/** Byte ranges for a payload of `size`, each at most `chunk` long. */
export function chunkRanges(size: number, chunk = CHUNK_SIZE): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (let start = 0; start < size; start += chunk) ranges.push({ start, end: Math.min(size, start + chunk) });
  return ranges;
}

/**
 * Sends and receives Blobs over one RTCDataChannel as a JSON header, binary chunks and
 * a JSON footer. Backpressure waits for `bufferedamountlow` so large photos never stall
 * the channel.
 */
export class BlobTransfer {
  private readonly received = new Subject<ReceivedBlob>();
  readonly blobs$: Observable<ReceivedBlob> = this.received.asObservable();

  private incoming: { header: Extract<Header, { kind: 'blob-start' }>; parts: ArrayBuffer[]; bytes: number } | null = null;
  private sending: Promise<void> = Promise.resolve();

  constructor(private readonly channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = LOW_WATER_MARK;
    channel.onmessage = (event) => this.receive(event.data);
  }

  /** Queues the blob; transfers run one at a time in order. Resolves when fully sent. */
  send(blob: Blob, meta: BlobMeta = {}, id = uid('blob')): Promise<string> {
    const run = this.sending.then(() => this.doSend(blob, meta, id));
    this.sending = run.catch(() => undefined);
    return run.then(() => id);
  }

  close(): void {
    this.channel.onmessage = null;
    this.incoming = null;
    this.received.complete();
  }

  private async doSend(blob: Blob, meta: BlobMeta, id: string): Promise<void> {
    if (this.channel.readyState !== 'open') throw new Error('channel closed');
    const header: Header = { kind: 'blob-start', id, size: blob.size, type: blob.type, meta };
    this.channel.send(JSON.stringify(header));
    const buffer = await blob.arrayBuffer();
    for (const { start, end } of chunkRanges(buffer.byteLength)) {
      await this.waitForRoom();
      if (this.channel.readyState !== 'open') throw new Error('channel closed');
      this.channel.send(buffer.slice(start, end));
    }
    this.channel.send(JSON.stringify({ kind: 'blob-end', id } satisfies Header));
  }

  private waitForRoom(): Promise<void> {
    if (this.channel.bufferedAmount < HIGH_WATER_MARK) return Promise.resolve();
    return new Promise((resolve) => {
      const done = (): void => {
        this.channel.removeEventListener('bufferedamountlow', done);
        resolve();
      };
      this.channel.addEventListener('bufferedamountlow', done);
    });
  }

  private receive(data: unknown): void {
    if (typeof data === 'string') {
      let header: Header;
      try {
        header = JSON.parse(data) as Header;
      } catch {
        return;
      }
      if (header.kind === 'blob-start') {
        this.incoming = { header, parts: [], bytes: 0 };
      } else if (header.kind === 'blob-end' && this.incoming?.header.id === header.id) {
        const { header: h, parts } = this.incoming;
        this.incoming = null;
        this.received.next({ id: h.id, blob: new Blob(parts, { type: h.type }), meta: h.meta });
      }
      return;
    }
    if (data instanceof ArrayBuffer && this.incoming) {
      this.incoming.parts.push(data);
      this.incoming.bytes += data.byteLength;
      if (this.incoming.bytes > this.incoming.header.size) this.incoming = null; // corrupt stream, drop
    }
  }
}
