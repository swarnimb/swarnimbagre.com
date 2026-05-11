describe('smoke', () => {
  it('runs basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('vitest').toContain('test');
  });
});
