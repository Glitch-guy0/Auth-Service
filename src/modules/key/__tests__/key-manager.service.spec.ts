import { KeyManagerService } from '../key-manager.service';
import * as fs from 'fs';

jest.mock('fs');

const mockKeyData = {
  kid: 'test-kid-123',
  publicKey: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
  privateKey: '-----BEGIN PRIVATE KEY-----\ndef\n-----END PRIVATE KEY-----',
  createdAt: '2026-07-15T14:02:46.882Z',
  expiresAt: '2027-07-15T14:02:46.882Z',
};

describe('KeyManagerService', () => {
  let service: KeyManagerService;

  beforeEach(() => {
    service = new KeyManagerService();
    jest.clearAllMocks();
  });

  describe('getPublicKey', () => {
    it('should return the public key for a valid kid', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockKeyData));

      const result = await service.getPublicKey('test-kid-123');
      expect(result).toBe(mockKeyData.publicKey);
    });

    it('should throw when keys.json does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.getPublicKey('test-kid-123')).rejects.toThrow(
        'Keys file not found',
      );
    });

    it('should throw when kid does not match', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockKeyData));

      await expect(service.getPublicKey('wrong-kid')).rejects.toThrow(
        'Key with kid "wrong-kid" not found',
      );
    });

    it('should throw when keys.json is missing required fields', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ kid: 'only-kid' }));

      await expect(service.getPublicKey('only-kid')).rejects.toThrow(
        'Keys file is missing required fields',
      );
    });

    it('should throw on invalid JSON in keys.json', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('not valid json');

      await expect(service.getPublicKey('any')).rejects.toThrow();
    });
  });

  describe('getPrivateKey', () => {
    it('should return the private key', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockKeyData));

      const result = await service.getPrivateKey();
      expect(result).toBe(mockKeyData.privateKey);
    });

    it('should throw when keys.json does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.getPrivateKey()).rejects.toThrow('Keys file not found');
    });

    it('should throw when keys.json is missing required fields', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ kid: 'only-kid' }));

      await expect(service.getPrivateKey()).rejects.toThrow(
        'Keys file is missing required fields',
      );
    });
  });
});
