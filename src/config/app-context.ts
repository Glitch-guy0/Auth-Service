export interface LogManager {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface AppContext {
  logManager: LogManager;
  config: Record<string, unknown>;
}

let instance: AppContext | null = null;

export function getAppContext(): AppContext {
  if (!instance) {
    throw new Error('AppContext not initialized. Call setAppContext() first.');
  }
  return instance;
}

export function setAppContext(ctx: AppContext): void {
  if (instance && process.env.NODE_ENV === 'production') {
    throw new Error('AppContext already initialized. Cannot call setAppContext() twice in production.');
  }
  instance = ctx;
}

export function resetAppContext(): void {
  instance = null;
}
