import chalk from 'chalk';
import { PinoLogger } from '../pino-logger';

describe('PinoLogger', () => {
  let stdoutWriteSpy: jest.SpyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    stdoutWriteSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should implement all ILogger methods', () => {
    const logger = new PinoLogger('Test');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('should default to info level when invalid level is provided', () => {
    const logger = new PinoLogger('Test', 'invalid');
    logger.debug('should be suppressed');
    logger.info('should appear');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).not.toContain('"level":"debug"');
    expect(output).toContain('"level":"info"');
  });

  it('should suppress info messages when level is set to warn', () => {
    const logger = new PinoLogger('Test', 'warn');
    logger.info('should not appear');
    logger.warn('should appear');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).not.toContain('"msg":"should not appear"');
    expect(output).toContain('"msg":"should appear"');
  });

  it('should emit debug messages with level "debug" when level is debug', () => {
    const logger = new PinoLogger('Test', 'debug');
    logger.debug('debug msg');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toContain('"level":"debug"');
  });

  it('should include module name in JSON output', () => {
    const logger = new PinoLogger('Auth', 'debug');
    logger.info('hello');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toContain('"module":"Auth"');
  });

  it('should include structured context in JSON output', () => {
    const logger = new PinoLogger('Test', 'debug');
    logger.info({ userId: '123' }, 'User created');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toContain('"userId":"123"');
  });

  it('should include timestamp in ISO 8601 format', () => {
    const logger = new PinoLogger('Test', 'debug');
    logger.info('timestamped');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should call process.exit(1) on fatal', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const logger = new PinoLogger('Test', 'debug');
    logger.fatal('unrecoverable');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('should not emit ANSI codes in production mode', () => {
    process.env.NODE_ENV = 'production';
    const logger = new PinoLogger('Test', 'debug');
    logger.info('prod message');
    const output = stdoutWriteSpy.mock.calls
      .map((c: any) => String(c[0]))
      .join('');
    const ansiRegex = /\u001b\[[0-9;]*m/;
    expect(ansiRegex.test(output)).toBe(false);
  });

  it('should apply chalk colors in development mode', () => {
    process.env.NODE_ENV = 'development';
    const prevLevel = chalk.level;
    chalk.level = 1;
    const devSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new PinoLogger('Test', 'debug');
    logger.info('dev message');
    const output = devSpy.mock.calls.map((c: any) => String(c[0])).join('');
    const ansiRegex = /\u001b\[[0-9;]*m/;
    expect(ansiRegex.test(output)).toBe(true);
    devSpy.mockRestore();
    chalk.level = prevLevel;
  });
});
