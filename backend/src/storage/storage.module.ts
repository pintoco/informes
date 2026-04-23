import { Module } from '@nestjs/common';
import { StorageInitService } from './storage-init.service';

@Module({
  providers: [StorageInitService],
})
export class StorageModule {}
