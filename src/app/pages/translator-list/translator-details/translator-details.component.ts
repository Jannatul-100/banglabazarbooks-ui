import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Translator } from '../../../interfaces/common/translator.interface';
import { Product } from '../../../interfaces/common/product';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { TranslatorService } from '../../../services/common/translator.service';
import { ProductService } from '../../../services/common/product.service';
import { ProductCardOneComponent } from '../../../shared/components/product-card-one/product-card-one.component';
import { SpecialPackageComponent } from '../../home/special-package/special-package.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../../services/core/seo.service';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { stripHtml } from '../../../core/utils/html-content.util';

import { FormsModule } from '@angular/forms';
import { Publisher } from '../../../interfaces/common/publisher.interface';
import { Category } from '../../../interfaces/common/category.interface';
import { PublisherService } from '../../../services/common/publisher.service';
import { CategoryService } from '../../../services/common/category.service';

@Component({
  selector: 'app-translator-details',
  templateUrl: './translator-details.component.html',
  styleUrls: ['./translator-details.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    MatProgressSpinnerModule,
    ProductCardOneComponent,
    SpecialPackageComponent,
    BreadcrumbComponent,
    SafeHtmlPipe,
  ],
})
export class TranslatorDetailsComponent implements OnInit, OnDestroy {
  // Signals
  translator = signal<Translator | null>(null);
  products = signal<Product[]>([]);
  breadcrumbItems = signal<BreadcrumbItem[]>([]);
  isLoading = signal<boolean>(false);
  isLoadingProducts = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  currentPage = signal<number>(0);
  pageSize = signal<number>(12);
  hasMoreProducts = signal<boolean>(false);
  totalBooks = signal<number>(0);

  // Filters
  publishers = signal<Publisher[]>([]);
  categories = signal<Category[]>([]);
  selectedPublisher = signal<string>('');
  selectedCategory = signal<string>('');
  selectedSort = signal<string>('newest');

  // Dependencies
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translatorService = inject(TranslatorService);
  private productService = inject(ProductService);
  private publisherService = inject(PublisherService);
  private categoryService = inject(CategoryService);
  private seoService = inject(SeoService);
  public translateService = inject(TranslateService);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.fetchPublishers();
    this.fetchCategories();
    const subRoute = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.fetchTranslatorData(slug);
      }
    });
    this.subscriptions.push(subRoute);
  }

  private fetchTranslatorData(slug: string) {
    this.isLoading.set(true);
    const sub = this.translatorService.getTranslatorBySlug(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const translatorData = res.data;
          if (translatorData.slug && translatorData.slug !== slug) {
            this.router.navigate(['/translator', translatorData.slug], { replaceUrl: true });
            return;
          }
          this.translator.set(translatorData);
          this.updateMetaData(translatorData);
          this.updateBreadcrumbs(translatorData);
          this.fetchTranslatorProducts(translatorData);
        } else {
          const displayName = decodeURIComponent(slug).replace(/-/g, ' ');
          const fallbackTranslator: Translator = {
            name: displayName,
            nameEn: displayName,
            slug: slug,
          };
          this.translator.set(fallbackTranslator);
          this.updateMetaData(fallbackTranslator);
          this.updateBreadcrumbs(fallbackTranslator);
          this.fetchTranslatorProducts(fallbackTranslator);
        }
        this.isLoading.set(false);
      },
      error: () => {
        const displayName = decodeURIComponent(slug).replace(/-/g, ' ');
        const fallbackTranslator: Translator = {
          name: displayName,
          nameEn: displayName,
          slug: slug,
        };
        this.translator.set(fallbackTranslator);
        this.updateMetaData(fallbackTranslator);
        this.updateBreadcrumbs(fallbackTranslator);
        this.fetchTranslatorProducts(fallbackTranslator);
        this.isLoading.set(false);
      },
    });
    this.subscriptions.push(sub);
  }

  private updateMetaData(translator: Translator) {
    const name = translator.name || translator.nameEn || '';
    const bio = stripHtml(translator.description || translator.descriptionEn || '');

    this.seoService.updateMetaData({
      title: `${name} এর অনুবাদ করা বই`,
      description: bio
        ? bio.slice(0, 160)
        : `${name} এর অনুবাদ করা সব বই, জীবনী ও পরিচিতি Banglabazar Books এ দেখুন।`,
      image: translator.image,
      author: name,
      type: 'profile',
      canonicalPath: `/translator/${translator.slug}`,
    });
  }

  private updateBreadcrumbs(translator: Translator) {
    this.breadcrumbItems.set([
      { label: 'হোম', url: '/' },
      { label: 'অনুবাদক', url: '/product-list' },
      { label: translator.name || translator.nameEn || '', url: `/translator/${translator.slug}` },
    ]);
  }

  private fetchTranslatorProducts(translator: Translator, isLoadMore = false) {
    if (!isLoadMore) {
      this.currentPage.set(0);
      this.products.set([]);
    }

    const orConditions: any[] = [];
    if (translator._id) {
      orConditions.push({ 'translator._id': translator._id });
    }
    if (translator.slug) {
      orConditions.push({ 'translator.slug': translator.slug });
    }
    if (translator.name) {
      orConditions.push({ translatorName: translator.name });
    }
    if (translator.nameEn) {
      orConditions.push({ translatorNameEn: translator.nameEn });
    }

    let sortObj: any = { createdAt: -1 };
    if (this.selectedSort() === 'bestseller') {
      sortObj = { priority: -1 };
    } else if (this.selectedSort() === 'price-low') {
      sortObj = { salePrice: 1 };
    } else if (this.selectedSort() === 'price-high') {
      sortObj = { salePrice: -1 };
    }

    const filterObj: any = {
      status: 'publish',
    };

    if (orConditions.length > 1) {
      filterObj.$or = orConditions;
    } else if (orConditions.length === 1) {
      Object.assign(filterObj, orConditions[0]);
    }

    if (this.selectedPublisher()) {
      filterObj['publisher._id'] = this.selectedPublisher();
    }
    if (this.selectedCategory()) {
      filterObj['category._id'] = this.selectedCategory();
    }

    const filter: FilterData = {
      filter: filterObj,
      select: {
        name: 1,
        nameEn: 1,
        quantity: 1,
        images: 1,
        author: 1,
        editor: 1,
        translator: 1,
        publisher: 1,
        category: 1,
        translatorName: 1,
        discountAmount: 1,
        discountType: 1,
        salePrice: 1,
        costPrice: 1,
        slug: 1,
        isPreOrder: 1,
        freeDelivery: 1,
        offerDiscountAmount: 1,
        offerDiscountType: 1,
        resetDiscount: 1,
        tags: 1,
      },
      sort: sortObj,
      pagination: { pageSize: this.pageSize(), currentPage: this.currentPage() },
    };

    if (isLoadMore) {
      this.isLoadingMore.set(true);
    } else {
      this.isLoadingProducts.set(true);
    }

    const sub = this.productService.getAllProducts(filter).subscribe({
      next: (res) => {
        if (res.success) {
          if (isLoadMore) {
            this.products.update((prev) => [...prev, ...res.data]);
          } else {
            this.products.set(res.data);
          }
          this.totalBooks.set(res.count);
          this.hasMoreProducts.set(this.products().length < res.count);
        }
        this.isLoadingProducts.set(false);
        this.isLoadingMore.set(false);
      },
      error: () => {
        this.isLoadingProducts.set(false);
        this.isLoadingMore.set(false);
      },
    });
    this.subscriptions.push(sub);
  }

  onFilterChange() {
    this.currentPage.set(0);
    const trans = this.translator();
    if (trans) {
      this.fetchTranslatorProducts(trans);
    }
  }

  onResetFilters() {
    this.selectedPublisher.set('');
    this.selectedCategory.set('');
    this.selectedSort.set('newest');
    this.onFilterChange();
  }

  private fetchPublishers() {
    const filter: FilterData = {
      filter: { status: 'publish' },
      select: { name: 1, nameEn: 1, slug: 1 },
      pagination: { pageSize: 200, currentPage: 0 },
      sort: { name: 1 },
    };
    this.publisherService.getAllPublishers(filter).subscribe({
      next: (res) => {
        if (res.data) this.publishers.set(res.data);
      },
    });
  }

  private fetchCategories() {
    const filter: FilterData = {
      filter: { status: 'publish' },
      select: { name: 1, nameEn: 1, slug: 1 },
      pagination: { pageSize: 200, currentPage: 0 },
      sort: { name: 1 },
    };
    this.categoryService.getAllCategory(filter).subscribe({
      next: (res: any) => {
        if (res && res.data) this.categories.set(res.data);
      },
    });
  }

  loadMoreProducts() {
    const trans = this.translator();
    if (!trans) return;
    this.currentPage.update((val) => val + 1);
    this.fetchTranslatorProducts(trans, true);
  }

  translatorBioHtml(): string {
    const t = this.translator();
    if (!t) return '';

    return this.translateService.currentLang === 'en'
      ? t.descriptionEn || t.description || ''
      : t.description || t.descriptionEn || '';
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }
}
