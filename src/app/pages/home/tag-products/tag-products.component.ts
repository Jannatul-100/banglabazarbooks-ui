import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
  effect,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService } from '../../../services/common/product.service';
import { ProductCardOneComponent } from '../../../shared/components/product-card-one/product-card-one.component';
import { CardOneLoaderComponent } from '../../../shared/skeleton-loader/card-one-loader/card-one-loader.component';
import { Tag } from '../../../interfaces/common/tag.interface';
import { Product } from '../../../interfaces/common/product';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tag-products',
  templateUrl: './tag-products.component.html',
  styleUrls: ['./tag-products.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProductCardOneComponent,
    CardOneLoaderComponent,
    TranslateModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TagProductsComponent implements OnInit, OnDestroy {
  tag = input.required<Tag>();
  index = input<number>(0);

  products = signal<Product[]>([]);
  isLoading = signal(true);
  hasLoaded = signal(false);

  swiperEl = viewChild<ElementRef>('swiperEl');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly productService = inject(ProductService);
  private readonly el = inject(ElementRef);
  readonly isBrowser = isPlatformBrowser(this.platformId);

  private observer?: IntersectionObserver;
  private subscriptions: Subscription[] = [];

  readonly skeletonItems = [1, 2, 3, 4, 5, 6];

  constructor() {
    effect(() => {
      const data = this.products();
      const el = this.swiperEl();
      if (this.isBrowser && data.length > 0 && el && !this.isLoading()) {
        this.initSwiper(el.nativeElement);
      }
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      this.startLoading();
      return;
    }

    if (this.index() >= 2) {
      this.isLoading.set(false);
    }

    // First sections are near the fold — fetch immediately.
    if (this.index() < 2) {
      this.startLoading();
      return;
    }

    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.startLoading();
          this.observer?.disconnect();
        }
      });
    }, { rootMargin: '450px 0px' });

    this.observer.observe(this.el.nativeElement);
  }

  private startLoading(): void {
    if (this.hasLoaded()) {
      return;
    }
    this.hasLoaded.set(true);
    this.isLoading.set(true);
    this.fetchProducts();
  }

  private fetchProducts(): void {
    const tag = this.tag();
    const isBestSeller =
      tag.slug === 'best-selling-books' ||
      tag.slug === 'best-seller' ||
      tag.name === 'Best selling books';

    if (isBestSeller) {
      this.fetchBestSellers();
      return;
    }

    const queryPayload: any = {
      status: 'publish',
    };
    if (tag.slug) {
      queryPayload['tags.slug'] = tag.slug;
    }
    if (tag._id) {
      queryPayload['tags._id'] = tag._id;
    }
    if (tag.name) {
      queryPayload['tags.name'] = tag.name;
    }

    const sub = this.productService
      .getAllProductsByUi(
        queryPayload,
        1,
        12,
      )
      .subscribe({
        next: (res) => {
          this.products.set(res.data ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.products.set([]);
          this.isLoading.set(false);
        },
      });
    this.subscriptions.push(sub);
  }

  private fetchBestSellers(): void {
    const mSelect = {
      name: 1,
      nameEn: 1,
      images: 1,
      salePrice: 1,
      quantity: 1,
      totalSold: 1,
      author: 1,
      discountAmount: 1,
      discountType: 1,
      tags: 1,
      slug: 1,
      category: 1,
      freeDelivery: 1,
      isPreOrder: 1,
      offerDiscountAmount: 1,
      offerDiscountType: 1,
      isTag: 1,
      tagImage: 1,
    };

    const filter: FilterData = {
      select: mSelect,
      sort: { totalSold: -1 },
      filter: { status: 'publish' },
      pagination: { pageSize: 12, currentPage: 0 },
    };

    const sub = this.productService.getAllProducts(filter, null).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.products.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.products.set([]);
        this.isLoading.set(false);
      },
    });
    this.subscriptions.push(sub);
  }

  private initSwiper(el: HTMLElement & { initialize?: () => void }): void {
    const swiperParams = {
      slidesPerView: 2,
      spaceBetween: 12,
      navigation: true,
      loop: false,
      breakpoints: {
        650: { slidesPerView: 3, spaceBetween: 14 },
        850: { slidesPerView: 4, spaceBetween: 16 },
        1080: { slidesPerView: 5, spaceBetween: 18 },
        1200: { slidesPerView: 6, spaceBetween: 20 },
      },
      injectStyles: [
        `
        .swiper-button-next,
        .swiper-button-prev {
          color: #f5c518;
          background: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px !important;
          height: 48px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          opacity: 1 !important;
          visibility: visible !important;
        }
        .swiper-button-next svg,
        .swiper-button-prev svg {
          width: 10px !important;
          height: 10px !important;
        }
        .swiper-button-next:after,
        .swiper-button-prev:after {
          content: none !important;
        }
        .swiper-button-next:hover,
        .swiper-button-prev:hover {
          background: #f5c518;
          color: #2f2b1c;
        }
        @media (max-width: 730px) {
          .swiper-button-next,
          .swiper-button-prev {
            width: 36px !important;
            height: 36px !important;
          }
        }
        `,
      ],
    };

    Object.assign(el, swiperParams);
    el.initialize?.();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
