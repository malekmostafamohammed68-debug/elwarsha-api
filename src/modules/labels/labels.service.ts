import { Injectable } from '@nestjs/common';
import { LabelsRepository } from './labels.repository.js';

@Injectable()
export class LabelsService {
  constructor(private readonly labelsRepository: LabelsRepository) {}

  async findAll() {
    return this.labelsRepository.findAll();
  }
}