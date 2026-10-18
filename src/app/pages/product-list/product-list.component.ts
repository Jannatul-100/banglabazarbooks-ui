import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Poster } from '../../interfaces/common/poster';
import { SubCategory } from '../../interfaces/common/sub-category.interface';
import { SubCategoryService } from '../../services/common/sub-category.service';
import { ReloadService } from '../../services/core/reload.service';
import { POSTER } from '../../core/db/poster.db';
import { Author } from '../../interfaces/common/author.interface';
import { Banner } from '../../interfaces/common/banner.interface';
import { Category } from '../../interfaces/common/category.interface';
import { FilterData } from '../../interfaces/gallery/filter-data';
import { AuthorService } from '../../services/common/author.service';
import { BannerService } from '../../services/common/banner.service';
import { CategoryService } from '../../services/common/category.service';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { SeoPageService } from "../../services/common/seo-page.service";
import { SeoPage } from "../../interfaces/common/seo-page.interface";
import { CommonModule } from '@angular/common';
import { PosterCardOneComponent } from '../../shared/components/poster-card-one/poster-card-one.component';
import { ProductsComponent } from './products/products.component';
import { SeoService } from '../../services/core/seo.service';
import { SeoInternalLinksComponent } from '../../shared/components/seo-internal-links/seo-internal-links.component';
import { Product } from '../../interfaces/common/product';
import { getProductCanonicalPath } from '../../core/utils/product-seo.util';
import { PublisherService } from '../../services/common/publisher.service';
import { Publisher } from '../../interfaces/common/publisher.interface';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    ProductsComponent,
    PosterCardOneComponent,
    SeoInternalLinksComponent,
    SafeHtmlPipe
  ]
})
export class ProductListComponent implements OnInit, OnDestroy {
  // Signals
  categories = signal<Category[]>([]);
  subCategories = signal<SubCategory[]>([]);
  publishers = signal<Publisher[]>([]);
  authors = signal<Author[]>([]);
  listBanners = signal<Banner[]>([]);
  isLoadingAuthor = signal<boolean>(false);
  isLoadingPublisher = signal<boolean>(false);
  isBannerLoading = signal<boolean>(false);
  filterSlide = signal<boolean>(false);
  seoPage = signal<SeoPage | null>(null);

  // Search Filter Signals
  categorySearch = signal<string>('');
  subCategorySearch = signal<string>('');
  publisherSearch = signal<string>('');
  authorSearch = signal<string>('');

  // Normal Data
  posters: Poster[] = POSTER;
  slug: string | null = null;
  categoryId: string | null = null;
  subCategorySlug: string | null = null;
  subCategoryId: string | null = null;
  authorSlug: string | null = null;
  authorId: string | null = null;
  publisherSlug: string | null = null;
  publisherId: string | null = null;
  language: string | null = null;
  translatorName: string | null = null;
  publisherName = signal<string | null>(null);
  publisherDescription = signal<string | null>(null);
  authorName = signal<string | null>(null);
  totalProductsCount = signal<number>(0);
  selectedSort = signal<string>('');

  // Computed
  slugCategory = computed(() => {
    return this.categories().find(c => c.slug === this.slug);
  });

  filteredCategories = computed(() => {
    const q = this.categorySearch().trim().toLowerCase();
    if (!q) return this.categories();
    return this.categories().filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.nameEn && c.nameEn.toLowerCase().includes(q))
    );
  });

  filteredSubCategories = computed(() => {
    const q = this.subCategorySearch().trim().toLowerCase();
    if (!q) return this.subCategories();
    return this.subCategories().filter(s =>
      (s.name && s.name.toLowerCase().includes(q))
    );
  });

  filteredPublishers = computed(() => {
    const q = this.publisherSearch().trim().toLowerCase();
    if (!q) return this.publishers();
    return this.publishers().filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q))
    );
  });

  filteredAuthors = computed(() => {
    const q = this.authorSearch().trim().toLowerCase();
    if (!q) return this.authors();
    return this.authors().filter(a =>
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.nameEn && a.nameEn.toLowerCase().includes(q))
    );
  });

  // Dependencies
  private seoService = inject(SeoService);
  private seoPageService = inject(SeoPageService);
  private reloadService = inject(ReloadService);
  private activatedRoute = inject(ActivatedRoute);
  private bannerService = inject(BannerService);
  private categoryService = inject(CategoryService);
  private authorService = inject(AuthorService);
  private subCategoryService = inject(SubCategoryService);
  private publisherService = inject(PublisherService);
  public translateService = inject(TranslateService);
  private router = inject(Router);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const subRoute = this.activatedRoute.queryParamMap.subscribe((res) => {
      this.slug = res.get('categories');
      this.categoryId = res.get('categoryId');
      this.subCategorySlug = res.get('subCategory');
      this.subCategoryId = res.get('subCategoryId');
      this.authorSlug = res.get('author');
      this.authorId = res.get('id');
      this.publisherSlug = res.get('publisher');
      this.publisherId = res.get('publisherId');
      this.language = res.get('language');
      this.translatorName = res.get('translatorName');

      if (this.categoryId) {
        this.fetchSubCategories(this.categoryId);
      } else if (!this.slug) {
        this.subCategories.set([]);
      }

      if (this.publisherId) {
        this.fetchPublisher(this.publisherId);
      } else if (this.publisherSlug) {
        this.resolvePublisherBySlug(this.publisherSlug);
      } else {
        this.publisherName.set(null);
        this.publisherDescription.set(null);
      }

      if (this.authorId || this.authorSlug) {
        this.resolveAuthor(this.authorId, this.authorSlug);
      } else {
        this.authorName.set(null);
      }

      this.selectedSort.set(res.get('sort') || '');
      this.updatePageSchema();
    });

    this.subscriptions.push(subRoute);

    this.fetchSeoPage();
    this.fetchCategories();
    this.fetchBanners();
    this.fetchPublishers();
    this.fetchAuthors();
  }

  onSortChange(val: string): void {
    this.selectedSort.set(val);
    const queryParams = { ...this.activatedRoute.snapshot.queryParams };
    if (val) {
      queryParams['sort'] = val;
    } else {
      delete queryParams['sort'];
    }
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  onClearFilter(type?: 'category' | 'subCategory' | 'author' | 'publisher'): void {
    if (!type) {
      this.router.navigate(['/product-list']);
      return;
    }
    const queryParams = { ...this.activatedRoute.snapshot.queryParams };
    if (type === 'category') {
      delete queryParams['categories'];
      delete queryParams['categoryId'];
      delete queryParams['subCategory'];
      delete queryParams['subCategoryId'];
      this.subCategories.set([]);
    } else if (type === 'subCategory') {
      delete queryParams['subCategory'];
      delete queryParams['subCategoryId'];
    } else if (type === 'author') {
      delete queryParams['author'];
      delete queryParams['id'];
      this.authorName.set(null);
    } else if (type === 'publisher') {
      delete queryParams['publisher'];
      delete queryParams['publisherId'];
      this.publisherName.set(null);
      this.publisherDescription.set(null);
    }
    this.router.navigate(['/product-list'], { queryParams });
  }

  onClearActive(): void {
    this.onClearFilter();
  }

  showCategorySlide() {
    this.reloadService.needRefreshCategorySlide(true);
  }

  private fetchCategories() {
    const filter: FilterData = {
      filter: null,
      select: { name: 1, nameEn: 1, slug: 1, image: 1 },
      pagination: null,
      sort: { serial: 1 },
    };
    this.isLoadingAuthor.set(true);

    const subCat = this.categoryService.getAllCategory(filter, null).subscribe({
      next: (res) => {
        if (res.success) {
          this.categories.set(res.data);
          this.isLoadingAuthor.set(false);
          this.updatePageSchema();
        }
      },
      error: (err) => {
        this.isLoadingAuthor.set(false);
        console.log(err);
      }
    });
    this.subscriptions.push(subCat);
  }

  private fetchPublishers() {
    const filter: FilterData = {
      filter: null,
      select: { name: 1, nameEn: 1, slug: 1, image: 1 },
      pagination: null,
      sort: { name: 1 },
    };
    this.isLoadingPublisher.set(true);

    const subPublisher = this.publisherService.getAllPublishers(filter, undefined).subscribe({
      next: (res) => {
        if (res.success) {
          this.publishers.set(res.data);
          if (this.publisherSlug && !this.publisherName()) {
            this.resolvePublisherBySlug(this.publisherSlug);
          }
        }
        this.isLoadingPublisher.set(false);
      },
      error: (err) => {
        this.isLoadingPublisher.set(false);
        console.log(err);
      }
    });
    this.subscriptions.push(subPublisher);
  }

  private resolvePublisherBySlug(slug: string) {
    const found = this.publishers().find(p => p.slug === slug);
    if (found) {
      const name = (this.translateService.currentLang === 'en' && found.nameEn ? found.nameEn : found.name) || null;
      this.publisherName.set(name);
      if (found._id) {
        this.fetchPublisher(found._id);
      }
    } else {
      const filter: FilterData = {
        filter: { slug },
        select: { name: 1, nameEn: 1, description: 1, descriptionEn: 1 },
        pagination: null,
        sort: null,
      };
      this.publisherService.getAllPublishers(filter, undefined).subscribe({
        next: (res) => {
          if (res.success && res.data && res.data.length > 0) {
            const pub = res.data[0];
            const name = (this.translateService.currentLang === 'en' && pub.nameEn ? pub.nameEn : pub.name) || null;
            const desc = (this.translateService.currentLang === 'en' && pub.descriptionEn ? pub.descriptionEn : pub.description) || pub.description || pub.descriptionEn || null;
            this.publisherName.set(name);
            this.publisherDescription.set(desc);
            this.updatePageSchema();
          }
        }
      });
    }
  }

  private resolveAuthor(id: string | null, slug: string | null) {
    const found = this.authors().find(a => (id && a._id === id) || (slug && a.slug === slug));
    if (found) {
      const name = (this.translateService.currentLang === 'en' && found.nameEn ? found.nameEn : found.name) || null;
      this.authorName.set(name);
      this.updatePageSchema();
    } else if (slug) {
      this.authorService.getAuthorBySlug(slug).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const name = (this.translateService.currentLang === 'en' && res.data.nameEn ? res.data.nameEn : res.data.name) || null;
            this.authorName.set(name);
            this.updatePageSchema();
          }
        }
      });
    }
  }

  private fetchPublisher(id: string) {
    const subPublisher = this.publisherService.getPublisherById(id, 'name nameEn description descriptionEn').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const name = (this.translateService.currentLang === 'en' && res.data.nameEn ? res.data.nameEn : res.data.name) || null;
          const desc = (this.translateService.currentLang === 'en' && res.data.descriptionEn ? res.data.descriptionEn : res.data.description) || res.data.description || res.data.descriptionEn || null;
          this.publisherName.set(name);
          this.publisherDescription.set(desc);
          this.updatePageSchema();
        }
      },
      error: (err) => console.log('fetchPublisher err:', err)
    });
    this.subscriptions.push(subPublisher);
  }

  private fetchSubCategories(id: string) {
    const mSelect = 'name slug image priority readOnly createdAt category';
    const subSub = this.subCategoryService.getSubCategoriesByCategoryId(id, mSelect).subscribe({
      next: (res) => {
        this.subCategories.set(res.data);
      },
      error: (error) => console.log(error)
    });
    this.subscriptions.push(subSub);
  }

  private fetchBanners() {
    const filterData: FilterData = {
      filter: null,
      select: { name: 1, slug: 1, image: 1, bannerType: 1, url: 1 },
      sort: null,
      pagination: null,
    };

    this.isBannerLoading.set(true);
    const subBanner = this.bannerService.getAllBanners(filterData, null).subscribe({
      next: (res) => {
        if (res.success) {
          this.listBanners.set(res.data.filter((d) => d.bannerType === 'productListBanner1'));
          this.isBannerLoading.set(false);
        }
      },
      error: (err) => {
        this.isBannerLoading.set(false);
        console.log(err);
      }
    });
    this.subscriptions.push(subBanner);
  }

  private fetchAuthors() {
    const filter: FilterData = {
      select: { name: 1, nameEn: 1, slug: 1, image: 1, createdAt: 1, description: 1, birthDate: 1 },
      filter: null,
      sort: { name: 1 },
      pagination: null,
    };

    this.isLoadingAuthor.set(true);
    const subAuthor = this.authorService.getAllAuthors(filter, null).subscribe({
      next: (res) => {
        if (res.success) {
          this.authors.set(res.data);
          if ((this.authorId || this.authorSlug) && !this.authorName()) {
            this.resolveAuthor(this.authorId, this.authorSlug);
          }
          this.isLoadingAuthor.set(false);
        }
      },
      error: (err) => {
        console.log(err);
        this.isLoadingAuthor.set(false);
      }
    });
    this.subscriptions.push(subAuthor);
  }

  filterSlideToggle() {
    this.filterSlide.update(v => !v);
  }

  private fetchSeoPage() {
    const subSeo = this.seoPageService.getSeoPageByPageWithCache('product-list', 'name image seoDescription keyWord pageName')
      .subscribe({
        next: res => {
          this.seoPage.set(res);
          if (res) {
            this.updateMetaData();
          }
        },
        error: err => console.log(err)
      });
    this.subscriptions.push(subSeo);
  }

  private updateMetaData() {
    const page = this.seoPage();
    if (!page) return;

    this.seoService.updateMetaData({
      title: page.name,
      description: page.seoDescription,
      keywords: page.keyWord,
      image: page.image,
      canonicalPath: this.getListingCanonicalPath(),
    });
    this.updatePageSchema();
  }

  private updatePageSchema() {
    const category = this.slugCategory();
    const title = this.publisherName()
      ? this.publisherName()!
      : this.authorName()
        ? this.authorName()!
        : category
          ? (category.name || category.nameEn || '')
          : this.translatorName
            ? ('অনুবাদক: ' + this.translatorName)
            : 'সকল বই';

    const breadcrumbs = (this.publisherName() || this.authorName() || category || this.translatorName)
      ? [
          { label: 'সকল বই', url: '/product-list' },
          { label: title, isCurrent: true },
        ]
      : [{ label: 'সকল বই', isCurrent: true }];

    const canonicalPath = this.getListingCanonicalPath();
    this.seoService.setBreadcrumbSchema(canonicalPath, breadcrumbs);
  }

  onProductsChange(products: Product[]) {
    const page = this.seoPage();
    const category = this.slugCategory();
    const title = this.publisherName()
      ? this.publisherName()!
      : this.authorName()
        ? this.authorName()!
        : category
          ? (category.name || category.nameEn || '')
          : this.translatorName
            ? ('অনুবাদক: ' + this.translatorName)
            : 'সকল বই';

    const breadcrumbs = (this.publisherName() || this.authorName() || category || this.translatorName)
      ? [
          { label: 'সকল বই', url: '/product-list' },
          { label: title, isCurrent: true },
        ]
      : [{ label: 'সকল বই', isCurrent: true }];

    const items = products
      .filter((product) => product.slug)
      .map((product) => ({ url: getProductCanonicalPath(product.slug) }));

    if (!items.length) {
      this.updatePageSchema();
      return;
    }

    this.seoService.setCollectionSchema(
      this.getListingCanonicalPath(),
      title || page?.name || 'সকল বই',
      items,
      breadcrumbs
    );
  }

  private getListingCanonicalPath(): string {
    if (this.slug) return `/product-list?categories=${this.slug}`;
    if (this.publisherSlug) return `/product-list?publisher=${this.publisherSlug}`;
    if (this.authorSlug) return `/product-list?author=${this.authorSlug}`;
    if (this.translatorName) return `/product-list?translatorName=${encodeURIComponent(this.translatorName)}`;
    return '/product-list';
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
