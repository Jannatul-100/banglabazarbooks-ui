import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgxPaginationModule } from 'ngx-pagination';
import { Publisher } from '../../interfaces/common/publisher.interface';
import { FilterData } from '../../interfaces/gallery/filter-data';
import { PublisherService } from '../../services/common/publisher.service';
import { AuthorCardOneComponent } from '../../shared/components/author-card-one/author-card-one.component';
import { SeoService } from '../../services/core/seo.service';
import { SeoInternalLinksComponent } from '../../shared/components/seo-internal-links/seo-internal-links.component';

@Component({
  selector: 'app-publisher-list',
  templateUrl: './publisher-list.component.html',
  styleUrls: ['./publisher-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    MatProgressSpinnerModule,
    AuthorCardOneComponent,
    NgxPaginationModule,
    SeoInternalLinksComponent
  ]
})
export class PublisherListComponent implements OnInit, OnDestroy {
  publishers = signal<Publisher[]>([]);
  isLoading = signal<boolean>(false);
  totalPublishers = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(24);
  searchInputModel = '';

  private searchQuery: string | null = null;
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private publisherService = inject(PublisherService);
  private seoService = inject(SeoService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.updateSeoMeta();

    const subQueryParams = this.activatedRoute.queryParams.subscribe(params => {
      if (params['page']) {
        const page = parseInt(params['page'], 10);
        if (page > 0) {
          this.currentPage.set(page);
        }
      }
    });
    this.subscriptions.push(subQueryParams);

    this.searchInput$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((raw) => {
        const q = (raw ?? '').trim();
        this.searchQuery = q.length ? q : null;
        this.currentPage.set(1);
        this.router.navigate([], {
          relativeTo: this.activatedRoute,
          queryParams: { page: 1 },
          queryParamsHandling: 'merge',
        });
        this.fetchPublishers();
      });

    this.fetchPublishers();
  }

  onSearchModelChange(value: string) {
    this.searchInput$.next(value ?? '');
  }

  private updateSeoMeta() {
    this.seoService.updateMetaData({
      title: 'প্রকাশক তালিকা - বাংলা বাজার বুকস',
      description: 'বাংলা বাজার বুকস-এ প্রকাশিত বইগুলোর প্রকাশকদের তালিকা দেখুন।',
      keywords: 'প্রকাশক, পাবলিকেশন, বাংলাবাজার বুকস প্রকাশক',
      canonicalPath: '/publisher-list',
    });
    this.seoService.setBreadcrumbSchema('/publisher-list', [
      { label: 'প্রকাশক তালিকা', isCurrent: true },
    ]);
  }

  private fetchPublishers() {
    const filter: FilterData = {
      select: { name: 1, nameEn: 1, image: 1, slug: 1 },
      filter: null,
      sort: { priority: -1 },
      pagination: {
        pageSize: this.pageSize(),
        currentPage: this.currentPage() - 1
      }
    };

    this.isLoading.set(true);
    const sub = this.publisherService.getAllPublishers(filter, this.searchQuery ?? undefined).subscribe({
      next: (res) => {
        if (res.success) {
          this.publishers.set(res.data);
          this.totalPublishers.set(res.count);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
    this.subscriptions.push(sub);
  }

  onPageChange(event: number) {
    this.currentPage.set(event);
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: event },
      queryParamsHandling: 'merge'
    });
    this.fetchPublishers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
