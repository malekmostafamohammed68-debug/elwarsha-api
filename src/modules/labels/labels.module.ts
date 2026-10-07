import { Module } from '@nestjs/common';
import { LabelsController } from './labels.controller.js';
import { LabelsService } from './labels.service.js';
import { LabelsRepository } from './labels.repository.js';

@Module({
  controllers: [LabelsController],
  providers: [LabelsService, LabelsRepository],
  exports: [LabelsService],
})
export class LabelsModule {}