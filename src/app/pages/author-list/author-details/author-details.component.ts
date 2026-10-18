import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Author } from '../../../interfaces/common/author.interface';
import { Product } from '../../../interfaces/common/product';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { AuthorService } from '../../../services/common/author.service';
import { ProductService } from '../../../services/common/product.service';
import { ProductCardOneComponent } from '../../../shared/components/product-card-one/product-card-one.component';
import { SpecialPackageComponent } from '../../home/special-package/special-package.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../../services/core/seo.service';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { countWords, stripHtml } from '../../../core/utils/html-content.util';
import { AUTHOR_BIO_FALLBACK, GUARDIAN_TEAM_BIO_FALLBACK, isGuardianTeamAuthor } from '../../../core/utils/page-seo-fallbacks';



import { FormsModule } from '@angular/forms';
import { Publisher } from '../../../interfaces/common/publisher.interface';
import { Category } from '../../../interfaces/common/category.interface';
import { PublisherService } from '../../../services/common/publisher.service';
import { CategoryService } from '../../../services/common/category.service';

@Component({
  selector: 'app-author-details',
  templateUrl: './author-details.component.html',
  styleUrls: ['./author-details.component.scss'],
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
    SafeHtmlPipe
  ]
})
export class AuthorDetailsComponent implements OnInit, OnDestroy {
  // Signals
  author = signal<Author | null>(null);
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
  private authorService = inject(AuthorService);
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
    const subRoute = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.fetchAuthorData(slug);
      }
    });
    this.subscriptions.push(subRoute);
  }

  private fetchAuthorData(slug: string) {
    this.isLoading.set(true);
    const sub = this.authorService.getAuthorBySlug(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const authorData = res.data;
          if (authorData.slug && authorData.slug !== slug) {
            this.router.navigate(['/author', authorData.slug], { replaceUrl: true });
            return;
          }
          this.author.set(authorData);
          this.updateMetaData(authorData);
          this.updateBreadcrumbs(authorData);
          this.fetchAuthorProducts(authorData._id);
        } else {
          this.seoService.clearSchema();
          this.router.navigate(['/author-list']);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.seoService.clearSchema();
        this.isLoading.set(false);
        this.router.navigate(['/author-list']);
      }
    });
    this.subscriptions.push(sub);
  }

  private updateMetaData(author: Author) {
    const authorName = author.name || author.nameEn || '';
    const bio = stripHtml(author.description || author.descriptionEn || '');

    this.seoService.updateMetaData({
      title: authorName,
      description: bio
        ? bio.slice(0, 160)
        : `${authorName} এর বই, জীবনী ও প্রকাশিত গ্রন্থ সমূহ Banglabazar Books এ দেখুন।`,
      image: author.image,
      author: authorName,
      type: 'profile',
      canonicalPath: `/author/${author.slug}`,
    });

    const breadcrumbs = [
      { label: 'লেখক তালিকা', url: '/author-list' },
      { label: author.name!, isCurrent: true },
    ];
    this.seoService.setAuthorSchema(author, breadcrumbs);
  }

  private updateBreadcrumbs(author: Author) {
    this.breadcrumbItems.set([
      { label: 'হোম', url: '/' },
      { label: 'লেখক তালিকা', url: '/author-list' },
      { label: author.name!, url: `/author/${author.slug}` }
    ]);
  }

  private fetchAuthorProducts(authorId: any, isLoadMore = false) {
    if (!isLoadMore) {
      this.currentPage.set(0);
      this.products.set([]);
    }

    let sortObj: any = { createdAt: -1 };
    if (this.selectedSort() === 'bestseller') {
      sortObj = { priority: -1 };
    } else if (this.selectedSort() === 'price-low') {
      sortObj = { salePrice: 1 };
    } else if (this.selectedSort() === 'price-high') {
      sortObj = { salePrice: -1 };
    }

    const filterQuery: any = { "author._id": authorId, status: 'publish' };
    if (this.selectedPublisher()) {
      filterQuery["publisher._id"] = this.selectedPublisher();
    }
    if (this.selectedCategory()) {
      filterQuery["category._id"] = this.selectedCategory();
    }

    const filter: FilterData = {
      filter: filterQuery,
      select: { name: 1, nameEn: 1, quantity: 1, images: 1, author: 1, publisher: 1, category: 1, discountAmount: 1, discountType: 1, salePrice: 1, costPrice: 1, slug: 1, isPreOrder: 1, freeDelivery: 1, offerDiscountAmount: 1, offerDiscountType: 1, resetDiscount: 1, tags: 1 },
      sort: sortObj,
      pagination: { pageSize: this.pageSize(), currentPage: this.currentPage() }
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
            this.products.update(prev => [...prev, ...res.data]);
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
      }
    });
    this.subscriptions.push(sub);
  }

  onFilterChange() {
    this.currentPage.set(0);
    if (this.author()?._id) {
      this.fetchAuthorProducts(this.author()?._id);
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
      sort: { name: 1 }
    };
    this.publisherService.getAllPublishers(filter).subscribe({
      next: (res) => {
        if (res.data) this.publishers.set(res.data);
      }
    });
  }

  private fetchCategories() {
    const filter: FilterData = {
      filter: { status: 'publish' },
      select: { name: 1, nameEn: 1, slug: 1 },
      pagination: { pageSize: 200, currentPage: 0 },
      sort: { name: 1 }
    };
    this.categoryService.getAllCategory(filter).subscribe({
      next: (res: any) => {
        if (res && res.data) this.categories.set(res.data);
      }
    });
  }

  loadMoreProducts() {
    this.currentPage.update(val => val + 1);
    this.fetchAuthorProducts(this.author()?._id, true);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  authorBioHtml(): string {
    const author = this.author();
    if (!author) return '';

    const bio = this.translateService.currentLang === 'en'
      ? (author.descriptionEn || author.description || '')
      : (author.description || author.descriptionEn || '');

    return bio;
  }
}
