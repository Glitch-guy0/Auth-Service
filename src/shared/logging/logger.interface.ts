export interface ILogger {
  debug(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  debug(message: string, ...args: unknown[]): void;
  info(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  info(message: string, ...args: unknown[]): void;
  warn(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  warn(message: string, ...args: unknown[]): void;
  error(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  error(message: string, ...args: unknown[]): void;
  fatal(
    context: Record<string, unknown>,
    message: string,
    ...args: unknown[]
  ): void;
  fatal(message: string, ...args: unknown[]): void;
}
