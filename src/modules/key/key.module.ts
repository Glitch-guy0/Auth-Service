import { Module } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';
import { KEY_MANAGER } from '@shared/lib/interfaces/key-manager.token';

@Module({
  providers: [
    {
      provide: KEY_MANAGER,
      useClass: KeyManagerService,
    },
  ],
  exports: [KEY_MANAGER],
})
export class KeyModule {}
