import { describe, expect, it } from 'vitest';
import { BlobTransfer, CHUNK_SIZE, chunkRanges } from './blob-transfer';
import { parseBoothMessage } from './booth-messages';

/** Two fake channels wired to each other, delivering on a microtask. */
function pair(): [RTCDataChannel, RTCDataChannel] {
  const make = (): RTCDataChannel & { peer?: RTCDataChannel } =>
    ({
      readyState: 'open',
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      binaryType: 'arraybuffer',
      onmessage: null,
      send(data: unknown) {
        const target = (this as { peer?: RTCDataChannel }).peer;
        queueMicrotask(() => target?.onmessage?.({ data } as MessageEvent));
      },
      addEventListener() {},
      removeEventListener() {},
      close() {},
    }) as unknown as RTCDataChannel & { peer?: RTCDataChannel };
  const a = make();
  const b = make();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

describe('chunkRanges', () => {
  it('splits into fixed chunks with a short tail', () => {
    expect(chunkRanges(10, 4)).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 10 },
    ]);
    expect(chunkRanges(0)).toEqual([]);
    expect(chunkRanges(CHUNK_SIZE)).toEqual([{ start: 0, end: CHUNK_SIZE }]);
  });
});

describe('BlobTransfer', () => {
  it('round-trips a blob larger than one chunk with its metadata', async () => {
    const [a, b] = pair();
    const sender = new BlobTransfer(a);
    const receiver = new BlobTransfer(b);
    const bytes = new Uint8Array(CHUNK_SIZE * 3 + 123);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const original = new Blob([bytes], { type: 'image/jpeg' });

    const receivedPromise = new Promise<{ blob: Blob; meta: Record<string, unknown>; id: string }>((resolve) =>
      receiver.blobs$.subscribe(resolve),
    );
    const id = await sender.send(original, { shot: 2, captureId: 'c1' }, 'photo-1');
    const got = await receivedPromise;

    expect(id).toBe('photo-1');
    expect(got.id).toBe('photo-1');
    expect(got.meta).toEqual({ shot: 2, captureId: 'c1' });
    expect(got.blob.type).toBe('image/jpeg');
    expect(got.blob.size).toBe(original.size);
    expect(new Uint8Array(await got.blob.arrayBuffer())).toEqual(bytes);
  });

  it('sends queued blobs in order', async () => {
    const [a, b] = pair();
    const sender = new BlobTransfer(a);
    const receiver = new BlobTransfer(b);
    const ids: string[] = [];
    receiver.blobs$.subscribe((r) => ids.push(r.id));
    await Promise.all([
      sender.send(new Blob(['one']), {}, 'first'),
      sender.send(new Blob(['two']), {}, 'second'),
      sender.send(new Blob(['three']), {}, 'third'),
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(ids).toEqual(['first', 'second', 'third']);
  });
});

describe('parseBoothMessage', () => {
  it('accepts known types and rejects everything else', () => {
    expect(parseBoothMessage(JSON.stringify({ type: 'ping', id: 1, sentAt: 5 }))).toEqual({ type: 'ping', id: 1, sentAt: 5 });
    expect(parseBoothMessage(JSON.stringify({ type: 'nope' }))).toBeNull();
    expect(parseBoothMessage('not json')).toBeNull();
    expect(parseBoothMessage(new ArrayBuffer(4))).toBeNull();
    expect(parseBoothMessage(JSON.stringify(null))).toBeNull();
  });
});
