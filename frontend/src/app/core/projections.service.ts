import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateProjectionScenarioPayload,
  ProjectionPeriodType,
  ProjectionScenario,
  SuggestedUnitsResult,
  UpdateProjectionScenarioPayload,
} from './models/projection.model';

@Injectable({ providedIn: 'root' })
export class ProjectionsService {
  private readonly baseUrl = `${environment.apiUrl}/projections`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Promise<ProjectionScenario[]> {
    return firstValueFrom(this.http.get<ProjectionScenario[]>(this.baseUrl));
  }

  findOne(id: string): Promise<ProjectionScenario> {
    return firstValueFrom(this.http.get<ProjectionScenario>(`${this.baseUrl}/${id}`));
  }

  create(payload: CreateProjectionScenarioPayload): Promise<ProjectionScenario> {
    return firstValueFrom(this.http.post<ProjectionScenario>(this.baseUrl, payload));
  }

  update(id: string, payload: UpdateProjectionScenarioPayload): Promise<ProjectionScenario> {
    return firstValueFrom(this.http.patch<ProjectionScenario>(`${this.baseUrl}/${id}`, payload));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }

  getSuggestedUnits(productId: string, periodType: ProjectionPeriodType): Promise<SuggestedUnitsResult> {
    return firstValueFrom(
      this.http.get<SuggestedUnitsResult>(`${this.baseUrl}/suggested-units`, {
        params: { productId, periodType },
      }),
    );
  }
}
