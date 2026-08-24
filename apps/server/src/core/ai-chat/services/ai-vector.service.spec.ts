import { AiVectorService } from './ai-vector.service';

describe('AiVectorService', () => {
  const service = new AiVectorService({} as never, {} as never);

  it('splits long page content into overlapping chunks', () => {
    const content = Array.from({ length: 500 }, (_, index) => `sentence-${index}.`).join(' ');
    const chunks = service.chunkContent(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
    expect(chunks[0]).not.toBe(chunks[1]);
  });

  it('returns no chunks for empty content', () => {
    expect(service.chunkContent('   ')).toEqual([]);
  });
});
