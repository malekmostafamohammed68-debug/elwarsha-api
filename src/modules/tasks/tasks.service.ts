import { Injectable } from '@nestjs/common';
import { LabelsService } from '../labels/labels.service.js';
import type { Assignment } from '../../domain/models.js';
import { TasksRepository } from './tasks.repository.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly labelsService: LabelsService,
  ) {}

  async listAssignments(): Promise<Assignment[]> {
    return this.tasksRepository.listAssignments();
  }
}