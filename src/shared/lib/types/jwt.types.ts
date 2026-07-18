export interface JwtPayload {
  sub: string;
  iat: number;
  iss: string;
  kid: string;
  exp: number;
  // TODO: Add role field in Phase 4 RBAC
}
