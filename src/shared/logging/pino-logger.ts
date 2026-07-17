import pino from 'pino';
import { ILogger } from './logger.interface';
import { ChalkTransport } from './chalk-transport';

const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
type ValidLevel = (typeof VALID_LEVELS)[number];

function isValidLevel(level: string): level is ValidLevel {
  return (VALID_LEVELS as readonly string[]).includes(level);
}

export class PinoLogger implements ILogger {
  private pino: pino.Logger;

  constructor(moduleName: string, level: string = 'info') {
    const resolvedLevel: ValidLevel = isValidLevel(level) ? level : 'info';

    const streams: pino.StreamEntry[] = [];

    if (process.env.NODE_ENV !== 'production') {
      streams.push({
        stream: new ChalkTransport(),
        level: resolvedLevel as pino.Level,
      });
    } else {
      streams.push({
        stream: process.stdout,
        level: resolvedLevel as pino.Level,
      });
    }

    this.pino = pino(
      {
        name: moduleName,
        level: resolvedLevel,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
      },
      pino.multistream(streams),
    ).child({ module: moduleName });
  }

  debug(message: string, ...args: unknown[]): void;
  debug(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  debug(
    contextOrMessage: Record<string, unknown> | string,
    ...rest: unknown[]
  ): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.debug(
        { args: rest.length ? rest : undefined },
        contextOrMessage,
      );
    } else {
      const [message, ...args] = rest;
      this.pino.debug(
        { ...contextOrMessage, args: args.length ? args : undefined },
        message as string,
      );
    }
  }

  info(message: string, ...args: unknown[]): void;
  info(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  info(
    contextOrMessage: Record<string, unknown> | string,
    ...rest: unknown[]
  ): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.info(
        { args: rest.length ? rest : undefined },
        contextOrMessage,
      );
    } else {
      const [message, ...args] = rest;
      this.pino.info(
        { ...contextOrMessage, args: args.length ? args : undefined },
        message as string,
      );
    }
  }

  warn(message: string, ...args: unknown[]): void;
  warn(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  warn(
    contextOrMessage: Record<string, unknown> | string,
    ...rest: unknown[]
  ): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.warn(
        { args: rest.length ? rest : undefined },
        contextOrMessage,
      );
    } else {
      const [message, ...args] = rest;
      this.pino.warn(
        { ...contextOrMessage, args: args.length ? args : undefined },
        message as string,
      );
    }
  }

  error(message: string, ...args: unknown[]): void;
  error(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  error(
    contextOrMessage: Record<string, unknown> | string,
    ...rest: unknown[]
  ): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.error(
        { args: rest.length ? rest : undefined },
        contextOrMessage,
      );
    } else {
      const [message, ...args] = rest;
      this.pino.error(
        { ...contextOrMessage, args: args.length ? args : undefined },
        message as string,
      );
    }
  }

  fatal(message: string, ...args: unknown[]): void;
  fatal(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  fatal(
    contextOrMessage: Record<string, unknown> | string,
    ...rest: unknown[]
  ): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.fatal(
        { args: rest.length ? rest : undefined },
        contextOrMessage,
      );
    } else {
      const [message, ...args] = rest;
      this.pino.fatal(
        { ...contextOrMessage, args: args.length ? args : undefined },
        message as string,
      );
    }
    process.exit(1);
  }
}
