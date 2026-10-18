import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Title, Meta } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { SpecialPackage } from '../../interfaces/common/special-package.interface';
import { CartService } from '../../services/common/cart.service';
import { SpecialPackagesService } from '../../services/common/special-packages.service';
import { UserService } from '../../services/common/user.service';
import { UiService } from '../../services/core/ui.service';
import { ReloadService } from '../../services/core/reload.service';
import { PipesModule } from '../../shared/pipes/pipes.module';
import { RelatedProductPackageComponent } from './related-product/related-product.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../services/core/seo.service';
import { Product } from '../../interfaces/common/product';
import { isInvalidPublicSlug } from '../../core/utils/html-content.util';


@Component({
  selector: 'app-special-package-details',
  templateUrl: './special-package-details.component.html',
  styleUrls: ['./special-package-details.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatButtonModule,
    MatButtonModule,
    PipesModule,
    RelatedProductPackageComponent,
    BreadcrumbComponent
  ]
})
export class SpecialPackageDetailsComponent implements OnInit, OnDestroy {
  // Signals
  specialPackage = signal<SpecialPackage | null>(null);
  relatedProducts = signal<Product[]>([]);
  breadcrumbItems = signal<BreadcrumbItem[]>([]);
  isLoading = signal<boolean>(false);
  quantity = signal<number>(1);

  // Dependencies
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private specialPackageService = inject(SpecialPackagesService);
  private cartService = inject(CartService);
  private uiService = inject(UiService);
  private reloadService = inject(ReloadService);
  private userService = inject(UserService);
  private seoService = inject(SeoService);
  public translateService = inject(TranslateService);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor() { }

  ngOnInit(): void {
    const subRoute = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        if (isInvalidPublicSlug(slug)) {
          this.router.navigate(['/special-package']);
          return;
        }
        this.fetchPackageDetails(slug);
      }
    });
    this.subscriptions.push(subRoute);
  }

  private fetchPackageDetails(slug: string) {
    this.isLoading.set(true);
    const sub = this.specialPackageService.getSpecialPackageBySlug(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const pkg = res.data;
          this.specialPackage.set(pkg);
          this.updateMetaData(pkg);
          this.updateBreadcrumbs(pkg);
          
          // Fetch related products
          if (pkg.products && pkg.products.length > 0) {
            const categoryIds = (pkg.products as any[])
              .map(p => p.category?._id)
              .filter(id => !!id);
            const uniqueCategoryIds = [...new Set(categoryIds)];
            
            if (uniqueCategoryIds.length > 0) {
              this.fetchRelatedProducts(uniqueCategoryIds);
            }
          }
        } else {
          this.seoService.clearSchema();
          this.router.navigate(['/special-package']);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.seoService.clearSchema();
        this.router.navigate(['/special-package']);
      }
    });
    this.subscriptions.push(sub);
  }

  private fetchRelatedProducts(categoryIds: string[]) {
    const sub = this.specialPackageService.getRelatedProductsByMultiCategoryId({
      ids: categoryIds,
      limit: 12
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.relatedProducts.set(res.data);
        }
      }
    });
    this.subscriptions.push(sub);
  }

  onAddToCart() {
    const pkg = this.specialPackage();
    if (!pkg) return;

    const cartData = {
      specialPackage: pkg._id,
      selectedQty: this.quantity(),
      cartType: 1
    };

    if (this.userService.getUserStatus()) {
      this.cartService.addToCart(cartData).subscribe((res: any) => {
        this.uiService.success(res.message);
        this.reloadService.needRefreshCart$(true);
      });
    } else {
      this.cartService.addComboCartItemToLocalStorage(cartData);
      this.uiService.success('প্যাকেজটি কার্টে যুক্ত হয়েছে।');
      this.reloadService.needRefreshCart$(true);
    }
  }

  onBuyNow() {
    this.onAddToCart();
    this.router.navigate(['/checkout']);
  }

  updateQuantity(val: number) {
    const newQty = this.quantity() + val;
    if (newQty >= 1) this.quantity.set(newQty);
  }

  getTranslatorsList(product: any): string[] {
    if (!product) return [];
    
    let bnNames: string[] = [];
    if (Array.isArray(product.translatorName)) {
      bnNames = product.translatorName.filter((n: string) => n && n.trim());
    } else if (typeof product.translatorName === 'string' && product.translatorName.trim()) {
      bnNames = [product.translatorName.trim()];
    }

    let enNames: string[] = [];
    if (Array.isArray(product.translatorNameEn)) {
      enNames = product.translatorNameEn.filter((n: string) => n && n.trim());
    } else if (typeof product.translatorNameEn === 'string' && product.translatorNameEn.trim()) {
      enNames = [product.translatorNameEn.trim()];
    }

    const isEn = this.translateService.currentLang === 'en';
    
    if (isEn) {
      if (enNames.length) return enNames;
      if (bnNames.length) return bnNames;
    } else {
      if (bnNames.length) return bnNames;
      if (enNames.length) return enNames;
    }
    
    return [];
  }

  getTranslators(product: any): { name: string; slug?: string }[] {
    if (!product) return [];
    const isEn = this.translateService.currentLang === 'en';

    if (product.translator && Array.isArray(product.translator) && product.translator.length) {
      return product.translator.map((t: any) => ({
        name: (isEn ? (t.nameEn || t.name) : (t.name || t.nameEn)) || t.name || '',
        slug: t.slug,
      }));
    }

    const names = this.getTranslatorsList(product);
    return names.map((n) => ({
      name: n,
      slug: n.trim().replace(/[\s_]+/g, '-'),
    }));
  }

  private updateMetaData(pkg: SpecialPackage) {
    this.seoService.updateMetaData({
      title: pkg.seoTitle || pkg.name,
      description: pkg.seoDescription || pkg.description || '',
      image: pkg.image,
      canonicalPath: `/special-package/${pkg.slug}`,
    });

    const breadcrumbs = [
      { label: 'বিশেষ প্যাকেজ', url: '/special-package' },
      { label: pkg.name!, isCurrent: true },
    ];
    this.seoService.setSpecialPackageSchema(pkg, breadcrumbs);
  }

  private updateBreadcrumbs(pkg: SpecialPackage) {
    this.breadcrumbItems.set([
      { label: 'বিশেষ প্যাকেজ', url: '/special-package' },
      { label: pkg.name!, isCurrent: true },
    ]);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
