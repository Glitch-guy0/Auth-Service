import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v7 as uuidv7 } from 'uuid';
import { KeyPair } from '../types/keys.types';

const KEYS_FILE = path.resolve(process.cwd(), 'keys.json');

function setupKeys(): void {
  if (fs.existsSync(KEYS_FILE)) {
    console.error(
      '⚠️  keys.json already exists. Aborting to prevent overwriting existing keys.',
    );
    process.exit(1);
  }

  const startTime = performance.now();

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const kid = uuidv7();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const elapsed = performance.now() - startTime;

  const keyData: KeyPair = {
    kid,
    publicKey,
    privateKey,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata: {
      algorithm: 'RS256',
      keySize: 2048,
      platform: os.platform(),
      architecture: os.arch(),
      generatedAt: now.toISOString(),
      generationTimeMs: Math.round(elapsed * 100) / 100,
    },
  };

  fs.writeFileSync(KEYS_FILE, JSON.stringify(keyData, null, 2), {
    mode: 0o600,
  });

  const stat = fs.statSync(KEYS_FILE);
  const mode = (stat.mode & 0o777).toString(8);
  if (mode !== '600') {
    console.error(`❌ Failed to set file permissions to 600. Current: ${mode}`);
    process.exit(1);
  }

  console.log('✅ keys.json generated successfully');
  console.log(`   kid:        ${kid}`);
  console.log(`   algorithm:  RS256 (2048-bit)`);
  console.log(`   platform:   ${os.platform()} ${os.arch()}`);
  console.log(`   generated:  ${now.toISOString()}`);
  console.log(`   expires:    ${expiresAt.toISOString()}`);
  console.log(`   time:       ${Math.round(elapsed)}ms`);
}

setupKeys();
