import { Injectable } from '@angular/core';
import { Translator } from 'src/app/interfaces/common/translator.interface';
import { environment } from 'src/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FilterData } from 'src/app/interfaces/gallery/filter-data';

const API_TRANSLATOR = `${environment.apiBaseLink}/api/translator/`;

@Injectable({
  providedIn: 'root',
})
export class TranslatorService {
  constructor(private httpClient: HttpClient) {}

  getAllTranslators(filterData: FilterData, searchQuery?: any) {
    let params = new HttpParams();
    if (searchQuery) {
      params = params.append('q', searchQuery);
    }
    return this.httpClient.post<{ data: Translator[]; success: boolean; count: number }>(
      `${API_TRANSLATOR}get-all/`,
      filterData,
      { params }
    );
  }

  getTranslatorById(id: string, select?: string) {
    let params = new HttpParams();
    if (select) {
      params = params.append('select', select);
    }
    return this.httpClient.get<{
      data: Translator;
      message: string;
      success: boolean;
    }>(API_TRANSLATOR + id, { params });
  }

  getTranslatorBySlug(slug: string, select?: string) {
    let params = new HttpParams();
    if (select) {
      params = params.append('select', select);
    }
    return this.httpClient.get<{
      data: Translator;
      message: string;
      success: boolean;
    }>(API_TRANSLATOR + 'get-by-slug/' + encodeURIComponent(slug), { params });
  }
}
