export interface KeyMetadata {
  algorithm: string;
  keySize: number;
  platform: string;
  architecture: string;
  generatedAt: string;
  generationTimeMs: number;
}

export interface KeyPair {
  kid: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
  expiresAt: string;
  metadata: KeyMetadata;
}
