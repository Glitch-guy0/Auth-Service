declare module 'express' {
  interface Request {
    requestId?: string;
  }
}

export {};
