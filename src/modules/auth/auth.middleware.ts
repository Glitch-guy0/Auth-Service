import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  accessToken?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      (req as AuthenticatedRequest).accessToken = authHeader.slice(7);
    }

    next();
  }
}
