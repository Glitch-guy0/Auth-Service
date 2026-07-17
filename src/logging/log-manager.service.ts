# LogManager Service

**Implementation for Story 8.2**

```ts
import { Injectable } from '@nestjs/common';
import { LogManager, AppContext } from '../app-context';
import { PinoLogger, Level } from 'pino')';

@Injectable()
export class LogManagerService implements LogManager {
  private logger: PinoLogger;

  constructor(private appContext: AppContext) {
    // Initialize Pino logger with configuration
    this.logger = new PinoLogger({
      level: process.env.LOG_LEVEL || Level.info,
      pretty: process.env.NODE_ENV === 'development',
      name: 'auth-service'
    });

    // Initialize chalk for console coloring if in terminal
    if (process.platform === 'win32' || process.platform.startsWith('darwin')) {
      this.logger.use(chalk);// Import chalk if needed
    }
  }

  info(message: string, ...args: unknown[]) {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(message, ...args);
  }

  // Add trace and log methods as needed
}
```
