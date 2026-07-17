import { Writable, WritableOptions } from 'stream';
import chalk from 'chalk';

const LEVEL_COLORS: Record<string, chalk.Chalk> = {
  debug: chalk.gray,
  info: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  fatal: chalk.magenta,
};

const LEVEL_LABELS: Record<string, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
};

export class ChalkTransport extends Writable {
  constructor(opts?: WritableOptions) {
    super({ ...opts, decodeStrings: false });
  }

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const raw = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    const trimmed = raw.trimEnd();

    try {
      const parsed = JSON.parse(trimmed);
      const level: string = parsed.level ?? 'info';
      const time: string = parsed.time ?? new Date().toISOString();
      const module: string = parsed.module ?? parsed.name ?? '';
      const msg: string = parsed.msg ?? '';
      const color = LEVEL_COLORS[level] ?? chalk.white;
      const label = LEVEL_LABELS[level] ?? level.toUpperCase();
      const prefix = module ? `[${module}]` : '';
      process.stdout.write(`${time} ${color(`[${label}]`)} ${prefix} ${msg}\n`);
    } catch {
      process.stdout.write(raw.endsWith('\n') ? raw : `${raw}\n`);
    }

    callback(null);
  }
}
