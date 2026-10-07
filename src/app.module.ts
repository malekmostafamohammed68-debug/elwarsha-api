import { Module } from "@nestjs/common";
import {LabelsModule} from "./modules/labels/labels.module.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { JobModule } from "./infrastructure/jobs/job.module.js";
import { PrismaModule } from "./infrastructure/prisma/prisma.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { GithubModule } from "./modules/github/github.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { TasksModule } from "./modules/tasks/tasks.module.js";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JobModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
    TasksModule,
    GithubModule,
    LabelsModule,
  ],
})
export class AppModule {}
