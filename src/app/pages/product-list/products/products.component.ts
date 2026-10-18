import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID, output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { Pagination } from "../../../interfaces/core/pagination";
import { CommonModule } from '@angular/common';
import { ProductCardOneComponent } from '../../../shared/components/product-card-one/product-card-one.component';
import { DATABASE_KEY } from '../../../core/utils/global-variable';
import { Product } from '../../../interfaces/common/product';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { ProductService } from '../../../services/common/product.service';
import { StorageService } from '../../../services/core/storage.service';
import { ReloadService } from '../../../services/core/reload.service';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ProductCardOneComponent
  ]
})
export class ProductsComponent implements OnInit, OnDestroy {
  productsChange = output<Product[]>();
  totalProductsChange = output<number>();

  // Signals
  products = signal<Product[]>([]);
  totalProducts = signal<number>(0);
  isLoading = signal<boolean>(false);
  isLoadMore = signal<boolean>(false);

  // Normal Data
  currentPage = 1;
  productsPerPage = 15;
  categorySlug: string | null = null;
  subCategorySlug: string | null = null;
  authorSlug: string | null = null;
  publisherSlug: string | null = null;
  tagsSlug: string | null = null;
  searchQuery: string | null = null;
  translatorName: string | null = null;
  selectedSort: string | null = null;
  id: string | null = null;

  // Dependencies
  private productService = inject(ProductService);
  private activatedRoute = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private reloadService = inject(ReloadService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const subQ = this.activatedRoute.queryParams.subscribe(qParam => {
      this.id = qParam['categoryId'];
      this.categorySlug = qParam['categories'];
      this.subCategorySlug = qParam['subCategory'];
      this.authorSlug = qParam['author'];
      this.publisherSlug = qParam['publisher'];
      this.tagsSlug = qParam['tags'];
      this.searchQuery = qParam['searchQuery'] || null;
      this.translatorName = qParam['translatorName'] || null;
      this.selectedSort = qParam['sort'] || null;

      const restoredState = this.restoreState();
      if (restoredState) {
        this.products.set(restoredState.products || []);
        this.currentPage = restoredState.currentPage || 1;
        this.totalProducts.set(restoredState.totalProducts || 0);
        this.totalProductsChange.emit(restoredState.totalProducts || 0);

        setTimeout(() => {
          if (restoredState.scrollPosition && this.isBrowser) {
            window.scrollTo(0, restoredState.scrollPosition);
          }
        }, 100);
        this.emitVisibleProducts();
      } else {
        this.fetchProducts();
      }
    });

    this.subscriptions.push(subQ);

    const subSearch = this.reloadService.refreshSearch$
      .pipe(filter((refresh) => refresh))
      .subscribe(() => {
        this.currentPage = 1;
        this.fetchProducts();
        this.reloadService.needRefreshSearch$(false);
      });
    this.subscriptions.push(subSearch);
  }

  fetchProducts(loadMore = false) {
    const pagination: Pagination = {
      pageSize: this.productsPerPage,
      currentPage: this.currentPage - 1
    };

    let sortObj: any = { priority: -1 };
    if (this.selectedSort === 'new_release') {
      sortObj = { createdAt: -1 };
    } else if (this.selectedSort === 'best_seller') {
      sortObj = { totalSold: -1, priority: -1 };
    } else if (this.selectedSort === 'price_low_to_high') {
      sortObj = { salePrice: 1 };
    } else if (this.selectedSort === 'price_high_to_low') {
      sortObj = { salePrice: -1 };
    }

    const filterData: FilterData = {
      filter: {
        ...(this.categorySlug && { "category.slug": this.categorySlug }),
        ...(this.subCategorySlug && { "subCategory.slug": this.subCategorySlug }),
        ...(this.authorSlug && { "author.slug": this.authorSlug }),
        ...(this.publisherSlug && { "publisher.slug": this.publisherSlug }),
        ...(this.tagsSlug && {
          $or: [
            { "tags.slug": this.tagsSlug },
            { "tags.name": this.tagsSlug },
            { "tags.slug": decodeURIComponent(this.tagsSlug) },
            { "tags.name": decodeURIComponent(this.tagsSlug) },
            { "tags.name": { $regex: this.tagsSlug, $options: 'i' } },
            { "tags.slug": { $regex: this.tagsSlug, $options: 'i' } }
          ]
        }),
        ...(this.translatorName && {
          $or: [
            { "translator.slug": this.translatorName },
            { "translator.name": this.translatorName },
            { "translator.nameEn": this.translatorName },
            { translatorName: this.translatorName },
            { translatorNameEn: this.translatorName }
          ]
        }),
        status: 'publish',
        ...(this.tagsSlug !== 'Coming Soon' && { 'tags.name': { $ne: 'Coming Soon' } })
      },
      select: {
        name: 1,
        nameEn: 1,
        images: 1,
        costPrice: 1,
        slug: 1,
        author: 1,
        editor: 1,
        translator: 1,
        category: 1,
        salePrice: 1,
        quantity: 1,
        discountAmount: 1,
        priority: 1,
        ratingCount: 1,
        ratingTotal: 1,
        discountType: 1,
        tags: 1,
        translatorName: 1,
        translatorNameEn: 1,
        freeDelivery: 1,
        isPreOrder: 1,
        offerDiscountAmount: 1,
        offerDiscountType: 1,
        resetDiscount: 1
      },
      sort: sortObj,
      pagination: pagination,
    };

    if (loadMore) {
      this.isLoadMore.set(true);
    } else {
      this.isLoading.set(true);
    }

    const subProducts = this.productService.getAllProducts(filterData, this.searchQuery).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isLoadMore.set(false);
        if (res) {
          if (loadMore) {
            this.products.update(prev => [...prev, ...res.data]);
          } else {
            this.products.set(res.data);
          }
          this.totalProducts.set(res.count);
          this.totalProductsChange.emit(res.count);
          this.saveState();
          this.emitVisibleProducts();
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isLoadMore.set(false);
        console.log(err);
      }
    });

    this.subscriptions.push(subProducts);
  }

  onLoadMore() {
    if (this.totalProducts() > this.products().length) {
      this.currentPage += 1;
      this.fetchProducts(true);
      this.saveState();
    }
  }

  private saveState(): void {
    const stateKey = this.getStateKey();
    const state = {
      products: this.products(),
      currentPage: this.currentPage,
      totalProducts: this.totalProducts(),
      scrollPosition: this.isBrowser ? (window.pageYOffset || document.documentElement.scrollTop) : 0,
      categorySlug: this.categorySlug,
      subCategorySlug: this.subCategorySlug,
      authorSlug: this.authorSlug,
      publisherSlug: this.publisherSlug,
      tagsSlug: this.tagsSlug,
      searchQuery: this.searchQuery,
      translatorName: this.translatorName,
      selectedSort: this.selectedSort
    };
    this.storageService.storeDataToSessionStorage(stateKey, state);
  }

  private restoreState(): any {
    const stateKey = this.getStateKey();
    const savedState = this.storageService.getDataFromSessionStorage(stateKey);

    if (savedState && savedState.products?.length > 0) {
      if (savedState.categorySlug === this.categorySlug &&
        savedState.subCategorySlug === this.subCategorySlug &&
        savedState.authorSlug === this.authorSlug &&
        savedState.publisherSlug === this.publisherSlug &&
        savedState.tagsSlug === this.tagsSlug &&
        savedState.searchQuery === this.searchQuery &&
        savedState.translatorName === this.translatorName &&
        savedState.selectedSort === this.selectedSort) {
        return savedState;
      }
    }
    return null;
  }

  private getStateKey(): string {
    const params = [
      this.categorySlug || '',
      this.subCategorySlug || '',
      this.authorSlug || '',
      this.publisherSlug || '',
      this.tagsSlug || '',
      this.searchQuery || '',
      this.translatorName || '',
      this.selectedSort || ''
    ].join('|');
    return `${DATABASE_KEY.productsListState}_v2_${params}`;
  }

  private emitVisibleProducts(): void {
    this.productsChange.emit(this.products());
  }

  ngOnDestroy(): void {
    if (this.products().length > 0) {
      this.saveState();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
