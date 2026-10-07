import { Controller, Get, UseGuards } from '@nestjs/common';
import { LabelsService } from './labels.service.js';
import { AuthGuard } from '../identity/auth.guard.js';

@Controller('api/v1/labels')
@UseGuards(AuthGuard) // 👈 التأكد من تطبيق حماية الـ AuthGuard
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  async getLabels() {
    return this.labelsService.findAll();
  }
}