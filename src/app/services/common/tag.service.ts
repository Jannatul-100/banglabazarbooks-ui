import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Tag } from '../../interfaces/common/tag.interface';
import { Observable, of, tap } from 'rxjs';

const API_URL = `${environment.apiBaseLink}/api/tag/`;

@Injectable({
  providedIn: 'root',
})
export class TagService {
  private readonly cacheKey = 'tag_cache';
  private tagCache = new Map<string, { data: Tag[]; message: string; success: boolean }>();
  private readonly httpClient = inject(HttpClient);

  getAllTags(): Observable<{ data: Tag[]; success: boolean; message: string }> {
    if (this.tagCache.has(this.cacheKey)) {
      return of(this.tagCache.get(this.cacheKey) as {
        data: Tag[];
        success: boolean;
        message: string;
      });
    }

    return this.httpClient
      .get<{ data: Tag[]; success: boolean; message: string }>(`${API_URL}get-all-data`)
      .pipe(
        tap((response) => {
          this.tagCache.set(this.cacheKey, response);
        }),
      );
  }
}
