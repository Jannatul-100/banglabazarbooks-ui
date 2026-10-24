import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Cart } from '../../../interfaces/common/cart.interface';
import { Product } from '../../../interfaces/common/product';
import { CartService } from '../../../services/common/cart.service';
import { ProductService } from '../../../services/common/product.service';
import { ShippingChargeService } from '../../../services/common/shipping-charge.service';
import { SpecialPackagesService } from '../../../services/common/special-packages.service';
import { UserService } from '../../../services/common/user.service';
import { WishListService } from '../../../services/common/wish-list.service';
import { ReloadService } from '../../../services/core/reload.service';
import { UiService } from '../../../services/core/ui.service';
import { DATABASE_KEY } from '../../../core/utils/global-variable';
import { EngBnNumPipe } from '../../../shared/pipes/eng-bn-num.pipe';
import { PricePipe } from '../../../shared/pipes/price.pipe';
import { SeoService } from '../../../services/core/seo.service';

export const SELECTED_CHECKOUT_ITEMS_KEY = 'BANGLABAZAR_SELECTED_CHECKOUT_ITEMS';

@Component({
  selector: 'app-cart-2',
  templateUrl: './cart-2.component.html',
  styleUrls: ['./cart-2.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatCheckboxModule,
    EngBnNumPipe,
    PricePipe
  ],
  providers: [PricePipe, EngBnNumPipe]
})
export class Cart2Component implements OnInit, OnDestroy {
  // Signals
  carts = signal<Cart[]>([]);
  selectedCartIds = signal<string[]>([]);
  isLoading = signal<boolean>(false);
  deliveryInDhaka = signal<number>(60);
  wishlistedProductIds = signal<Set<string>>(new Set<string>());

  // Dependencies
  private router = inject(Router);
  private productService = inject(ProductService);
  private userService = inject(UserService);
  private cartService = inject(CartService);
  private comboPackageService = inject(SpecialPackagesService);
  private shippingService = inject(ShippingChargeService);
  private wishListService = inject(WishListService);
  private reloadService = inject(ReloadService);
  private uiService = inject(UiService);
  private pricePipe = inject(PricePipe);
  private seoService = inject(SeoService);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  // Helper to extract an identifier for a cart item
  getItemKey(item: Cart): string {
    if (item._id) return item._id;
    if (item.product) {
      return typeof item.product === 'object' ? item.product._id! : (item.product as string);
    }
    return '';
  }

  isItemSelected(item: Cart): boolean {
    if (this.isStockOut(item.product)) return false;
    const key = this.getItemKey(item);
    return this.selectedCartIds().includes(key);
  }

  // Stockout Detection
  isStockOut(product: any): boolean {
    if (!product) return false;
    if (product.isPreOrder) return false;
    if (product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) return true;
    if (product.trackQuantity === true && (product.quantity === undefined || Number(product.quantity) <= 0)) return true;
    if (product.status === 'stock_out') return true;
    if (product.status && product.status !== 'publish' && product.status !== 'active') return true;
    return false;
  }

  // Selection Computeds
  totalCount = computed(() => this.carts().length);

  orderableCount = computed(() => {
    return this.carts().filter(item => !this.isStockOut(item.product)).length;
  });

  selectedCount = computed(() => {
    return this.carts().filter(item => this.isItemSelected(item)).length;
  });

  isAllSelected = computed(() => {
    const orderable = this.orderableCount();
    return orderable > 0 && this.selectedCount() === orderable;
  });

  isSomeSelected = computed(() => {
    const sel = this.selectedCount();
    const orderable = this.orderableCount();
    return sel > 0 && sel < orderable;
  });

  checkedCarts = computed(() => {
    return this.carts().filter(item => this.isItemSelected(item));
  });

  hasStockOutChecked = computed(() => false);

  // Price calculations for checked items
  regularTotal = computed(() => {
    return this.checkedCarts().reduce((acc, item) => {
      const product = item.product as any;
      if (!product) return acc;
      const reg = product?.regularPrice || product?.costPrice || (this.pricePipe.transform(product, 'regularPrice') as number) || product?.salePrice || 0;
      return acc + (reg * (item.selectedQty || 1));
    }, 0);
  });

  saleTotal = computed(() => {
    return this.checkedCarts().reduce((acc, item) => {
      const product = item.product as any;
      if (!product) return acc;
      const price = (this.pricePipe.transform(product, 'salePrice') as number) ?? (product?.salePrice || 0);
      return acc + (price * (item.selectedQty || 1));
    }, 0);
  });

  subTotal = computed(() => this.saleTotal());

  productDiscount = computed(() => {
    return Math.max(0, this.regularTotal() - this.saleTotal());
  });

  // Dynamic Shipping Charge for checked items (Default 60 tk in Cart page, +15 per 1000 above 1000)
  shippingCharge = computed(() => {
    const checked = this.checkedCarts();
    if (checked.length === 0) return 0;

    const hasFreeDelivery = checked.some(item => (item.product as any)?.freeDelivery === true);
    if (hasFreeDelivery) return 0;

    const bookTotal = this.saleTotal();
    const baseDelivery = 60; // Default 60 tk in Cart page
    const extraThousands = bookTotal > 1000 ? Math.ceil((bookTotal - 1000) / 1000) : 0;
    const extraCharge = extraThousands * 15;

    return baseDelivery + extraCharge;
  });

  rawTotal = computed(() => {
    if (this.checkedCarts().length === 0) return 0;
    return this.subTotal() + this.shippingCharge();
  });

  // Round Figure Logic: Total payable amount rounds down to nearest multiple of 5
  extraDiscount = computed(() => {
    const raw = this.rawTotal();
    if (raw === 0) return 0;
    return Math.max(0, raw % 5);
  });

  payableTotal = computed(() => {
    if (this.checkedCarts().length === 0) return 0;
    return Math.max(0, this.rawTotal() - this.extraDiscount());
  });

  totalSavings = computed(() => {
    return this.productDiscount() + this.extraDiscount();
  });

  // Header display totals (for checked items)
  headerRegularTotal = computed(() => this.regularTotal());
  headerSaleTotal = computed(() => this.saleTotal());

  ngOnInit(): void {
    this.seoService.clearSchema();
    this.seoService.updateMetaData({
      title: 'কার্ট | বাংলাবাজার বুকস',
      noIndex: true,
    });

    this.fetchShippingChargeConfig();
    this.fetchCartData(true);
    this.loadWishlistIds();

    const subCart = this.reloadService.refreshCart$.subscribe(() => this.fetchCartData(false));
    this.subscriptions.push(subCart);
  }

  private fetchShippingChargeConfig() {
    this.shippingService.getShippingCharge().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.deliveryInDhaka.set(res.data.deliveryInDhaka || 60);
        }
      },
      error: () => {}
    });
  }

  private fetchCartData(showLoader: boolean = false) {
    if (showLoader) {
      this.isLoading.set(true);
    }
    if (this.userService.getUserStatus()) {
      this.cartService.getCartByUser().subscribe({
        next: (res) => {
          const list = res.data || [];
          this.carts.set(list);
          this.initSelection(list);
          if (showLoader) this.isLoading.set(false);
        },
        error: () => {
          if (showLoader) this.isLoading.set(false);
        }
      });
    } else {
      this.fetchLocalCart(showLoader);
    }
  }

  private fetchLocalCart(showLoader: boolean = false) {
    const items = this.cartService.getCartItemFromLocalStorage();
    if (!items || items.length === 0) {
      this.carts.set([]);
      this.selectedCartIds.set([]);
      if (showLoader) this.isLoading.set(false);
      return;
    }

    const productIds = items.filter(i => !i.cartType || i.cartType === 2).map(i => i.product as string);
    const packageIds = items.filter(i => i.cartType === 1).map(i => i.specialPackage as string);

    const productObs = this.productService.getProductByIds(
      productIds,
      'name nameEn slug regularPrice costPrice salePrice discountType discountAmount images freeDelivery isPreOrder author quantity trackQuantity status'
    );
    const packageObs = this.comboPackageService.getProductByIds(packageIds);

    forkJoin([productObs, packageObs]).subscribe({
      next: ([pRes, sRes]) => {
        const products = pRes.data || [];
        const packages = sRes.data || [];

        const mapped = items.map(item => {
          if (item.cartType === 1) {
            const pkg = packages.find(p => p._id === item.specialPackage);
            if (!pkg) return item;
            return { ...item, product: { ...pkg, images: pkg.images || [] } };
          } else {
            const prod = products.find(p => p._id === item.product);
            return { ...item, product: prod };
          }
        });

        this.carts.set(mapped as any);
        this.initSelection(mapped as any);
        if (showLoader) this.isLoading.set(false);
      },
      error: () => {
        if (showLoader) this.isLoading.set(false);
      }
    });
  }

  /**
   * Initializes selection so all in-stock items are checked by default
   */
  private initSelection(items: Cart[]) {
    const validInStockKeys = items
      .filter(i => !this.isStockOut(i.product))
      .map(i => this.getItemKey(i))
      .filter(k => !!k);
    const current = this.selectedCartIds();
    if (current.length === 0) {
      this.selectedCartIds.set(validInStockKeys);
    } else {
      const valid = current.filter(k => validInStockKeys.includes(k));
      const newlyAdded = validInStockKeys.filter(k => !current.includes(k));
      this.selectedCartIds.set([...valid, ...newlyAdded]);
    }
  }

  // Master Checkbox Toggle
  toggleSelectAll(checked: boolean) {
    if (checked) {
      const inStockKeys = this.carts()
        .filter(i => !this.isStockOut(i.product))
        .map(i => this.getItemKey(i))
        .filter(k => !!k);
      this.selectedCartIds.set(inStockKeys);
    } else {
      this.selectedCartIds.set([]);
    }
  }

  // Single Item Checkbox Toggle
  toggleSelectItem(item: Cart) {
    if (this.isStockOut(item.product)) {
      this.uiService.wrong('দুঃখিত! বইটি বর্তমানে স্টকে নেই, তাই নির্বাচন করা যাবে না।');
      return;
    }
    const key = this.getItemKey(item);
    const current = this.selectedCartIds();
    if (current.includes(key)) {
      this.selectedCartIds.set(current.filter(k => k !== key));
    } else {
      this.selectedCartIds.set([...current, key]);
    }
  }

  // Delete all selected items via the master header trash icon
  deleteSelectedItems() {
    const selected = this.checkedCarts();
    if (selected.length === 0) {
      this.uiService.warn('মুছে ফেলার জন্য কোনো বই নির্বাচন করা হয়নি!');
      return;
    }

    if (this.userService.getUserStatus()) {
      const deleteObs = selected
        .filter(item => !!item._id)
        .map(item => this.cartService.deleteCartById(item._id!));

      if (deleteObs.length > 0) {
        forkJoin(deleteObs).subscribe({
          next: () => {
            this.selectedCartIds.set([]);
            this.reloadService.needRefreshCart$(false);
            this.uiService.success('নির্বাচিত বইগুলো কার্ট থেকে মুছে ফেলা হয়েছে');
          },
          error: () => this.uiService.wrong('বইগুলো মুছতে সমস্যা হয়েছে')
        });
      }
    } else {
      selected.forEach(cart => {
        if (cart.cartType === 1) {
          this.cartService.deleteComboCartItemFromLocalStorage(cart);
        } else {
          const productId = typeof cart.product === 'object' ? cart.product?._id : cart.product;
          if (productId) this.cartService.deleteCartItemFromLocalStorage(productId);
        }
      });
      this.selectedCartIds.set([]);
      this.reloadService.needRefreshCart$(false);
      this.uiService.success('নির্বাচিত বইগুলো কার্ট থেকে মুছে ফেলা হয়েছে');
    }
  }

  // Quantity controllers (Optimistic updates to eliminate loading flicker)
  onIncrementQty(cartId: string, index: number) {
    if (this.isStockOut(this.carts()[index]?.product)) {
      this.uiService.wrong('দুঃখিত! বইটি বর্তমানে স্টকে নেই, তাই সংখ্যা বাড়ানো যাবে না।');
      return;
    }
    const current = [...this.carts()];
    if (current[index]) {
      current[index] = {
        ...current[index],
        selectedQty: (current[index].selectedQty || 1) + 1
      };
      this.carts.set(current);
    }

    if (this.userService.getUserStatus()) {
      this.cartService.updateCartQty(cartId, { selectedQty: 1, type: 'increment' }).subscribe({
        next: () => {
          this.reloadService.needRefreshCart$(false);
        }
      });
    } else {
      const items = this.cartService.getCartItemFromLocalStorage();
      if (items[index]) {
        items[index].selectedQty = (items[index].selectedQty || 1) + 1;
        localStorage.setItem(DATABASE_KEY.userCart, JSON.stringify(items));
        this.reloadService.needRefreshCart$(false);
      }
    }
  }

  onDecrementQty(cartId: string, index: number, currentQty: number) {
    if (currentQty <= 1) return;
    const current = [...this.carts()];
    if (current[index]) {
      current[index] = {
        ...current[index],
        selectedQty: Math.max(1, (current[index].selectedQty || 1) - 1)
      };
      this.carts.set(current);
    }

    if (this.userService.getUserStatus()) {
      this.cartService.updateCartQty(cartId, { selectedQty: 1, type: 'decrement' }).subscribe({
        next: () => {
          this.reloadService.needRefreshCart$(false);
        }
      });
    } else {
      const items = this.cartService.getCartItemFromLocalStorage();
      if (items[index]) {
        items[index].selectedQty = Math.max(1, (items[index].selectedQty || 1) - 1);
        localStorage.setItem(DATABASE_KEY.userCart, JSON.stringify(items));
        this.reloadService.needRefreshCart$(false);
      }
    }
  }

  // Remove single item
  onRemoveItem(cart: Cart, index: number) {
    const key = this.getItemKey(cart);
    const updated = this.carts().filter((_, i) => i !== index);
    this.carts.set(updated);
    this.selectedCartIds.set(this.selectedCartIds().filter(k => k !== key));

    if (this.userService.getUserStatus()) {
      this.cartService.deleteCartById(cart._id!).subscribe({
        next: () => {
          this.reloadService.needRefreshCart$(false);
        }
      });
    } else {
      if (cart.cartType === 1) {
        this.cartService.deleteComboCartItemFromLocalStorage(cart);
      } else {
        const productId = typeof cart.product === 'object' ? cart.product?._id : cart.product;
        if (productId) this.cartService.deleteCartItemFromLocalStorage(productId);
      }
      this.reloadService.needRefreshCart$(false);
    }
  }

  // Wishlist Handling
  private loadWishlistIds() {
    if (this.userService.getUserStatus()) {
      this.wishListService.getWishListByUser().subscribe({
        next: (res) => {
          if (res.data) {
            const ids = new Set(res.data.map(w => typeof w.product === 'object' ? (w.product as any)?._id : w.product));
            this.wishlistedProductIds.set(ids);
          }
        },
        error: () => {}
      });
    } else {
      const local = this.wishListService.getWishListItemFromLocalStorage();
      const ids = new Set(local.map(w => typeof w.product === 'object' ? (w.product as any)?._id : (w.product as string)));
      this.wishlistedProductIds.set(ids);
    }
  }

  isWishlisted(item: Cart): boolean {
    const prodId = typeof item.product === 'object' ? item.product?._id : item.product;
    return prodId ? this.wishlistedProductIds().has(prodId) : false;
  }

  onToggleWishlist(cart: Cart) {
    const prodId = typeof cart.product === 'object' ? cart.product?._id : (cart.product as string);
    if (!prodId) return;

    if (!this.userService.getUserStatus()) {
      this.uiService.warn('উইশলিস্টে যুক্ত করতে অনুগ্রহ করে প্রথমে লগইন করুন');
      this.router.navigate(['/login'], { queryParams: { navigateFrom: this.router.url } });
      return;
    }

    const isAdded = this.wishlistedProductIds().has(prodId);

    if (isAdded) {
      this.uiService.warn('বইটি আগেই উইশলিস্টে যুক্ত করা আছে');
      return;
    }

    this.wishListService.addToWishList({ product: prodId, selectedQty: 1 } as any).subscribe({
      next: (res) => {
        if (res.success) {
          const current = new Set(this.wishlistedProductIds());
          current.add(prodId);
          this.wishlistedProductIds.set(current);
          this.uiService.success('উইশলিস্টে যুক্ত করা হয়েছে');
          this.reloadService.needRefreshWishList$(true);
        } else {
          this.uiService.warn(res.message || 'উইশলিস্টে যুক্ত করা সম্ভব হয়নি');
        }
      },
      error: () => this.uiService.wrong('উইশলিস্টে যুক্ত করতে সমস্যা হয়েছে')
    });
  }

  // Proceed to Step 2: Checkout
  onProceedToCheckout() {
    if (this.carts().length === 0) {
      this.uiService.warn('আপনার কার্টটি খালি!');
      return;
    }

    if (this.selectedCount() === 0) {
      this.uiService.warn('অর্ডার করতে অন্তত একটি বই নির্বাচন করুন!');
      return;
    }

    const validChecked = this.checkedCarts().filter(c => !this.isStockOut(c.product));
    if (validChecked.length === 0) {
      this.uiService.warn('অর্ডার করতে স্টকে থাকা অন্তত একটি বই নির্বাচন করুন!');
      return;
    }

    // Persist selected item IDs for Checkout Step 2 (Only in-stock items)
    if (typeof localStorage !== 'undefined') {
      const selectedProductIds = validChecked.map(c => {
        return typeof c.product === 'object' ? c.product?._id : c.product;
      }).filter(id => !!id);

      const validCartIds = validChecked.map(c => this.getItemKey(c)).filter(Boolean);

      const selectedPayload = {
        cartIds: validCartIds,
        productIds: selectedProductIds
      };
      localStorage.setItem(SELECTED_CHECKOUT_ITEMS_KEY, JSON.stringify(selectedPayload));
    }

    this.router.navigate(['/checkout']);
  }

  getProductAuthor(product: any): string {
    if (!product) return '';
    if (Array.isArray(product.author) && product.author.length > 0) {
      return product.author.map((a: any) => a.name || a.nameEn).filter(Boolean).join(', ');
    }
    if (product.author?.name) {
      return product.author.name;
    }
    return '';
  }

  getProductRegularPrice(product: any): number {
    if (!product) return 0;
    return product.regularPrice || product.costPrice || (this.pricePipe.transform(product, 'regularPrice') as number) || product.salePrice || 0;
  }

  getProductSalePrice(product: any): number {
    if (!product) return 0;
    return (this.pricePipe.transform(product, 'salePrice') as number) ?? (product.salePrice || 0);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
