import { Global, Module } from '@nestjs/common';
import { StorageInitService } from './storage-init.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, StorageInitService],
  exports: [StorageService],
})
export class StorageModule {}
