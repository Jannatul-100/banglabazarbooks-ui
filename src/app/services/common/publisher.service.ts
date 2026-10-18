import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Publisher } from '../../interfaces/common/publisher.interface';
import { environment } from '../../../environments/environment';
import { FilterData } from '../../interfaces/gallery/filter-data';

const API_PUBLISHER = `${environment.apiBaseLink}/api/publisher/`;

@Injectable({
  providedIn: 'root'
})
export class PublisherService {
  allPublisher: Publisher[] = [];

  constructor(private httpClient: HttpClient) {}

  getAllPublishers(filterData: FilterData, searchQuery?: string) {
    let params = new HttpParams();
    if (searchQuery) {
      params = params.append('q', searchQuery);
    }
    return this.httpClient.post<{ data: Publisher[]; success: boolean; count: number }>(
      `${API_PUBLISHER}get-all/`,
      filterData,
      { params }
    );
  }

  getPublisherById(id: string, select?: string) {
    let params = new HttpParams();
    if (select) {
      params = params.append('select', select);
    }
    return this.httpClient.get<{
      data: Publisher;
      message: string;
      success: boolean;
    }>(API_PUBLISHER + id, { params });
  }
}
