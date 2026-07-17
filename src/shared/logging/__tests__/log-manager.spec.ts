import { LogManagerService } from '../log-manager';

describe('LogManagerService', () => {
  let logManager: LogManagerService;
  let stdoutWriteSpy: jest.SpyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    stdoutWriteSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    logManager = new LogManagerService('info');
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should return an object with all 5 methods', () => {
    const logger = logManager.getLogger('Test');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('should return the same instance for the same module name', () => {
    const first = logManager.getLogger('Test');
    const second = logManager.getLogger('Test');
    expect(first).toBe(second);
  });

  it('should return different instances for different module names', () => {
    const a = logManager.getLogger('A');
    const b = logManager.getLogger('B');
    expect(a).not.toBe(b);
  });

  it('should include the module name in output', () => {
    const logger = logManager.getLogger('Auth');
    logger.info('hello');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toContain('"module":"Auth"');
    expect(output).toContain('"msg":"hello"');
  });

  it('should suppress info when level is warn', () => {
    const warnManager = new LogManagerService('warn');
    const logger = warnManager.getLogger('Test');
    logger.info('should not appear');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).not.toContain('"msg":"should not appear"');
  });

  it('should allow info when level is info', () => {
    const infoManager = new LogManagerService('info');
    const logger = infoManager.getLogger('Test');
    logger.info('visible');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toContain('"msg":"visible"');
  });

  it('should fallback to info for invalid log level', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const invalidManager = new LogManagerService('bogus');
    warnSpy.mockRestore();
    const logger = invalidManager.getLogger('Test');
    logger.info('fallback works');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toContain('"msg":"fallback works"');
  });

  it('should complete shutdown without error', () => {
    expect(() => logManager.shutdown()).not.toThrow();
  });
});
