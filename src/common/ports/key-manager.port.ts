export interface IKeyManager {
  getPublicKey(kid: string): Promise<string>;
  getPrivateKey(): Promise<string>;
}
