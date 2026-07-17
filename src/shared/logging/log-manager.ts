import { LogManager } from '@config/app-context';
import { ILogger } from './logger.interface';
import { PinoLogger } from './pino-logger';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
type ValidLogLevel = (typeof LOG_LEVELS)[number];

function isLogLevel(value: string): value is ValidLogLevel {
  return LOG_LEVELS.includes(value as ValidLogLevel);
}

export class LogManagerService implements LogManager {
  private loggers = new Map<string, ILogger>();
  private level: ValidLogLevel;

  constructor(level: string = 'info') {
    if (isLogLevel(level)) {
      this.level = level;
    } else {
      console.warn(`Invalid LOG_LEVEL "${level}" — falling back to "info"`);
      this.level = 'info';
    }
  }

  getLogger(moduleName: string): ILogger {
    let logger = this.loggers.get(moduleName);
    if (!logger) {
      logger = new PinoLogger(moduleName, this.level);
      this.loggers.set(moduleName, logger);
    }
    return logger!;
  }

  shutdown(): void {
    this.loggers.clear();
  }

  info(message: string, ...args: unknown[]): void {
    this.getLogger('App').info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.getLogger('App').warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.getLogger('App').error(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.getLogger('App').debug(message, ...args);
  }

  fatal(message: string, ...args: unknown[]): void {
    this.getLogger('App').fatal(message, ...args);
  }
}
