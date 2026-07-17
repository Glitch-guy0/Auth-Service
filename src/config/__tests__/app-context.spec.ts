import {
  getAppContext,
  setAppContext,
  resetAppContext,
  AppContext,
} from '../app-context';

function createMockContext(): AppContext {
  return {
    logManager: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
    },
    config: { env: 'test' },
  };
}

describe('app-context', () => {
  afterEach(() => {
    resetAppContext();
    delete process.env.NODE_ENV;
  });

  it('should throw when getAppContext is called before setAppContext', () => {
    expect(() => getAppContext()).toThrow('AppContext not initialized');
  });

  it('should return context after setAppContext', () => {
    const ctx = createMockContext();
    setAppContext(ctx);
    expect(getAppContext()).toBe(ctx);
  });

  it('should return the same instance on multiple calls', () => {
    const ctx = createMockContext();
    setAppContext(ctx);
    expect(getAppContext()).toBe(getAppContext());
  });

  it('should allow setAppContext in non-production after reset', () => {
    process.env.NODE_ENV = 'development';
    const first = createMockContext();
    setAppContext(first);
    resetAppContext();

    const second = createMockContext();
    setAppContext(second);
    expect(getAppContext()).toBe(second);
  });

  it('should throw on double setAppContext in production', () => {
    process.env.NODE_ENV = 'production';
    setAppContext(createMockContext());
    expect(() => setAppContext(createMockContext())).toThrow(
      'Cannot call setAppContext() twice in production',
    );
  });

  it('should clear instance on resetAppContext', () => {
    setAppContext(createMockContext());
    resetAppContext();
    expect(() => getAppContext()).toThrow('AppContext not initialized');
  });
});
