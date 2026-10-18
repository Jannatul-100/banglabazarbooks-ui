import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

import { LandingPage } from '../../interfaces/common/landing-page';
import { Product } from '../../interfaces/common/product';
import { Cart } from '../../interfaces/common/cart.interface';
import { LandingPageService } from '../../services/common/landing-page.service';
import { CartService } from '../../services/common/cart.service';
import { UserService } from '../../services/common/user.service';
import { UiService } from '../../services/core/ui.service';
import { ReloadService } from '../../services/core/reload.service';
import { SeoService } from '../../services/core/seo.service';
import { PricePipe } from '../../shared/pipes/price.pipe';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { isInvalidPublicSlug } from '../../core/utils/html-content.util';

const DEFAULT_PRIMARY = '#1a4d2e';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
  standalone: true,
  host: {
    class: 'landing-page-host',
    '[style.--lp-primary]': 'primaryColor()',
    '[style.--lp-primary-dark]': 'primaryColorDark()',
    '[style.--lp-primary-light]': 'primaryColorLight()',
  },
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MatProgressSpinnerModule,
    MatIconModule,
    PricePipe,
    SafeHtmlPipe,
  ],
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly landingPageService = inject(LandingPageService);
  private readonly cartService = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly uiService = inject(UiService);
  private readonly reloadService = inject(ReloadService);
  private readonly seoService = inject(SeoService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly translateService = inject(TranslateService);

  private readonly productsSection = viewChild<ElementRef<HTMLElement>>('productsSection');

  landingPage = signal<LandingPage | null>(null);
  isLoading = signal(true);
  selectedProductIds = signal<Set<string>>(new Set());

  primaryColor = computed(() => this.landingPage()?.primaryColor?.trim() || DEFAULT_PRIMARY);

  primaryColorDark = computed(() => this.shadeColor(this.primaryColor(), -18));

  primaryColorLight = computed(() => this.shadeColor(this.primaryColor(), 28));

  products = computed(() => this.landingPage()?.products ?? []);

  trustItems = computed(() => this.landingPage()?.trustItems ?? []);

  features = computed(() => this.landingPage()?.features ?? []);

  insidePages = computed(() => this.landingPage()?.insidePages ?? []);

  selectedCount = computed(() => this.selectedProductIds().size);

  hasHeroDiscount = computed(() => {
    const page = this.landingPage();
    return (page?.discountPercent ?? 0) > 0 || (page?.originalPrice ?? 0) > (page?.salePrice ?? 0);
  });

  heroDiscountLabel = computed(() => {
    const page = this.landingPage();
    if ((page?.discountPercent ?? 0) > 0) {
      return `-${page!.discountPercent}%`;
    }
    const original = page?.originalPrice ?? 0;
    const sale = page?.salePrice ?? 0;
    if (original > sale && original > 0) {
      return `-${Math.round(((original - sale) / original) * 100)}%`;
    }
    return '';
  });

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const subRoute = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) {
        this.router.navigate(['/']);
        return;
      }
      if (isInvalidPublicSlug(slug)) {
        this.router.navigate(['/']);
        return;
      }
      this.fetchLandingPage(slug);
    });
    this.subscriptions.push(subRoute);
  }

  private fetchLandingPage(slug: string): void {
    this.isLoading.set(true);
    const sub = this.landingPageService.getLandingPageBySlug(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          if (res.data.template === 'v2') {
            this.router.navigate(['/landing-page-2', slug]);
            return;
          }
          this.landingPage.set(res.data);
          this.initProductSelection(res.data.products ?? []);
          this.updateSeo(res.data);
        } else {
          this.seoService.clearSchema();
          this.router.navigate(['/']);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.seoService.clearSchema();
        this.router.navigate(['/']);
      },
    });
    this.subscriptions.push(sub);
  }

  private updateSeo(page: LandingPage): void {
    this.seoService.updateMetaData({
      title: page.seoTitle || page.title || page.name,
      description: page.seoDescription || page.subtitle || '',
      image: page.heroImage || page.images?.[0],
      canonicalPath: `/landing-page/${page.slug}`,
    });

    this.seoService.setWebPageSchema(
      `/landing-page/${page.slug}`,
      page.seoTitle || page.title || page.name || 'Promotion',
      [{ label: page.title || page.name || 'Promotion', isCurrent: true }],
    );
  }

  productTitle(product: Product): string {
    const isEn = this.translateService.currentLang === 'en';
    return isEn ? (product.nameEn || product.name) : product.name;
  }

  productImage(product: Product): string {
    return product.images?.length ? product.images[0]! : '/images/placeholder/test.png';
  }

  hasProductDiscount(product: Product): boolean {
    return (
      (product.discountType === 1 && (product.discountAmount ?? 0) > 0) ||
      (product.offerDiscountType === 1 && (product.offerDiscountAmount ?? 0) > 0) ||
      (product.discountType === 2 && (product.discountAmount ?? 0) > 0) ||
      (product.offerDiscountType === 2 && (product.offerDiscountAmount ?? 0) > 0)
    );
  }

  scrollToProducts(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const el = this.productsSection()?.nativeElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onOrderNow(): void {
    this.scrollToProducts();
  }

  onBuyNow(): void {
    const products = this.products();
    if (!products.length) {
      return;
    }
    if (!this.selectedCount()) {
      this.initProductSelection(products);
    }
    this.addSelectedProductsToCart(false);
    this.router.navigate(['/checkout']);
  }

  isProductSelected(productId?: string): boolean {
    return !!productId && this.selectedProductIds().has(productId);
  }

  toggleProductSelection(productId?: string): void {
    if (!productId) {
      return;
    }
    const next = new Set(this.selectedProductIds());
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    this.selectedProductIds.set(next);
  }

  onOrderSelected(): void {
    if (!this.selectedCount()) {
      this.uiService.warn('অনুগ্রহ করে অন্তত একটি বই নির্বাচন করুন।');
      return;
    }
    this.addSelectedProductsToCart(true);
    this.router.navigate(['/checkout']);
  }

  private initProductSelection(products: Product[]): void {
    const firstId = products[0]?._id;
    this.selectedProductIds.set(firstId ? new Set([firstId]) : new Set());
  }

  private addSelectedProductsToCart(showToast: boolean): void {
    const selected = this.products().filter((p) => this.isProductSelected(p._id));
    selected.forEach((product, index) => {
      this.addProductToCart(product, showToast && index === selected.length - 1);
    });
  }

  onAddToCart(product: Product, event?: Event): void {
    event?.stopPropagation();
    this.addProductToCart(product, true);
  }

  private addProductToCart(product: Product, showToast: boolean): void {
    const data: Cart = {
      product: product._id,
      selectedQty: 1,
    };

    if (this.userService.getUserStatus()) {
      const sub = this.cartService.addToCart(data).subscribe({
        next: (res) => {
          if (showToast) {
            this.uiService.success(res.message);
          }
          this.reloadService.needRefreshCart$(true);
        },
        error: () => {
          if (showToast) {
            this.uiService.wrong('কার্টে যোগ করা যায়নি।');
          }
        },
      });
      this.subscriptions.push(sub);
      return;
    }

    this.cartService.addCartItemToLocalStorage(data);
    if (showToast) {
      this.uiService.success('বইটি কার্টে যুক্ত হয়েছে।');
    }
    this.reloadService.needRefreshCart$(true);
  }

  isMaterialIcon(icon?: string): boolean {
    if (!icon) {
      return false;
    }
    return /^[a-z0-9_]+$/i.test(icon.trim());
  }

  private shadeColor(hex: string, percent: number): string {
    const normalized = hex.replace('#', '').trim();
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return hex;
    }

    const num = parseInt(normalized, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }
}
