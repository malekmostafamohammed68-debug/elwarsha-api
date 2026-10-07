import { Module } from '@nestjs/common';
import { LabelsModule } from '../labels/labels.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksRepository } from './tasks.repository.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [IdentityModule, LabelsModule],
  controllers: [TasksController],
  providers: [TasksRepository, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
