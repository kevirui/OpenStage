import { PcmFramer } from '../PcmFramer.js';

describe('PcmFramer', () => {
  it('splits PCM bytes into fixed-duration chunks with increasing offsets', () => {
    const framer = new PcmFramer(16000, 100); // 3200 bytes per chunk
    const chunks = framer.push(Buffer.alloc(8000));

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ sampleRate: 16000, offsetMs: 0, durationMs: 100 });
    expect(chunks[0].data.length).toBe(3200);
    expect(chunks[1].offsetMs).toBe(100);
  });

  it('buffers partial data across pushes', () => {
    const framer = new PcmFramer(16000, 100);

    expect(framer.push(Buffer.alloc(2000))).toHaveLength(0);
    expect(framer.push(Buffer.alloc(1200))).toHaveLength(1);
  });

  it('flushes the remainder as a shorter final chunk', () => {
    const framer = new PcmFramer(16000, 100);
    framer.push(Buffer.alloc(4800));

    const tail = framer.flush();
    expect(tail).toMatchObject({ offsetMs: 100, durationMs: 50 });
    expect(tail?.data.length).toBe(1600);
    expect(framer.flush()).toBeNull();
  });

  it('reports how much audio it has already emitted', () => {
    const framer = new PcmFramer(16000, 100);

    expect(framer.consumedMs).toBe(0);
    framer.push(Buffer.alloc(6400));
    expect(framer.consumedMs).toBe(200);
  });

  it('rejects invalid framing parameters', () => {
    expect(() => new PcmFramer(0, 100)).toThrow();
  });
});
