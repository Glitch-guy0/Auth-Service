export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorDetail {
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
