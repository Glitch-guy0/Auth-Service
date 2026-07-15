import { Injectable, Logger } from '@nestjs/common';
import { IKeyManager } from '../../common/ports/key-manager.port';
import * as fs from 'fs';
import * as path from 'path';

interface KeyData {
  kid: string;
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class KeyManagerService implements IKeyManager {
  private readonly logger = new Logger(KeyManagerService.name);
  private readonly keysFilePath = path.resolve(process.cwd(), 'keys.json');

  async getPublicKey(kid: string): Promise<string> {
    const keyData = this.readKeysFile();
    if (keyData.kid !== kid) {
      throw new Error(`Key with kid "${kid}" not found`);
    }
    return keyData.publicKey;
  }

  async getPrivateKey(): Promise<string> {
    const keyData = this.readKeysFile();
    const privateKey = keyData.privateKey;
    keyData.privateKey = '';
    this.logger.debug('Private key cleared from memory after use');
    return privateKey;
  }

  private readKeysFile(): KeyData {
    if (!fs.existsSync(this.keysFilePath)) {
      throw new Error(`Keys file not found at ${this.keysFilePath}`);
    }

    const raw = fs.readFileSync(this.keysFilePath, 'utf-8');
    const keyData = JSON.parse(raw) as KeyData;

    if (!keyData.kid || !keyData.publicKey || !keyData.privateKey) {
      throw new Error('Keys file is missing required fields (kid, publicKey, privateKey)');
    }

    return keyData;
  }
}
