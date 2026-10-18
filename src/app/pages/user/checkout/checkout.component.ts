import { Component, OnDestroy, OnInit, inject, signal, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Cart } from '../../../interfaces/common/cart.interface';
import { AreaService } from '../../../services/common/area.service';
import { CartService } from '../../../services/common/cart.service';
import { CouponService } from '../../../services/common/coupon.service';
import { DivisionService } from '../../../services/common/division.service';
import { OrderService } from '../../../services/common/order.service';
import { ProductService } from '../../../services/common/product.service';
import { ShippingChargeService } from '../../../services/common/shipping-charge.service';
import { SpecialPackagesService } from '../../../services/common/special-packages.service';
import { UserDataService } from '../../../services/common/user-data.service';
import { UserService } from '../../../services/common/user.service';
import { ZoneService } from '../../../services/common/zone.service';
import { ReloadService } from '../../../services/core/reload.service';
import { UiService } from '../../../services/core/ui.service';
import { DATABASE_KEY } from '../../../core/utils/global-variable';
import { GeneralDropdownComponent } from '../../../shared/components/general-dropdown/general-dropdown.component';
import { SelectToggleService } from '../../../services/common/select-toggle.service';
import { forkJoin, Subscription } from 'rxjs';
import { GtmService } from '../../../services/core/gtm.service';
import { OrderStatus } from '../../../enum/order.enum';
import { Product } from '../../../interfaces/common/product';
import { PricePipe } from '../../../shared/pipes/price.pipe';
import { UtilsService } from '../../../services/core/utils.service';
import { SeoService } from '../../../services/core/seo.service';


@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  standalone: true,
  providers: [PricePipe],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    GeneralDropdownComponent,
    PricePipe
  ]
})
export class CheckoutComponent implements OnInit, OnDestroy {
  // Signals
  carts = signal<Cart[]>([]);
  isLoading = signal<boolean>(false);
  shippingCharge = signal<number>(0);
  deliveryInDhaka = signal<number>(60);
  deliveryOutsideDhaka = signal<number>(110);

  // Totals Computed
  regularTotal = computed(() => {
    return this.carts().reduce((acc, item) => {
      const product = item.product as any;
      if (!product) return acc;
      const price = product?.regularPrice || (this.pricePipe.transform(product, 'regularPrice') as number) || product?.salePrice || 0;
      return acc + (price * (item.selectedQty || 1));
    }, 0);
  });

  saleTotal = computed(() => {
    return this.carts().reduce((acc, item) => {
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

  // Legacy compatibility getter
  discount = computed(() => this.productDiscount());

  // Coupon & Discount
  couponCode = signal<string>('');
  appliedCoupon = signal<any>(null);
  couponDiscount = signal<number>(0);

  extraDiscount = computed(() => {
    const rawTotal = this.saleTotal() - this.couponDiscount() + this.shippingCharge();
    return Math.max(0, rawTotal % 5);
  });

  grandTotal = computed(() => {
    return Math.max(0, Math.round(this.saleTotal() - this.couponDiscount() + this.shippingCharge() - this.extraDiscount()));
  });

  divisions = signal<any[]>([]);
  areas = signal<any[]>([]);
  zones = signal<any[]>([]);

  // Search
  searchDistrict = signal<string>('');
  searchArea = signal<string>('');

  filteredDivisions = signal<any[]>([]);
  filteredAreas = signal<any[]>([]);

  // Form
  checkoutForm!: FormGroup;

  editOrderId = signal<string | null>(null);

  // Dependencies
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cartService = inject(CartService);
  private couponService = inject(CouponService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private userDataService = inject(UserDataService);
  private shippingService = inject(ShippingChargeService);
  private divisionService = inject(DivisionService);
  private areaService = inject(AreaService);
  private zoneService = inject(ZoneService);
  private uiService = inject(UiService);
  private reloadService = inject(ReloadService);
  private productService = inject(ProductService);
  private comboPackageService = inject(SpecialPackagesService);
  private gtmService = inject(GtmService);
  private pricePipe = inject(PricePipe);
  private utilsService = inject(UtilsService);
  private seoService = inject(SeoService);
  private activatedRoute = inject(ActivatedRoute);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  private readonly _selectToggle = inject(SelectToggleService);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('app-general-dropdown')) {
      this._selectToggle.selectToggle.next('');
    }
  }

  ngOnInit(): void {
    this.seoService.clearSchema();
    this.seoService.updateMetaData({ title: 'চেকআউট', noIndex: true });
    this.initForm();

    this.activatedRoute.queryParams.subscribe(params => {
      const editOrderId = params['editOrder'];
      if (editOrderId) {
        this.editOrderId.set(editOrderId);
        this.fetchOrderForEdit(editOrderId);
      } else {
        this.fetchCarts();
      }
    });

    this.fetchDivisions();
    this.fetchShippingCharge();

    if (this.userService.getUserStatus()) {
      this.fetchUserData();
    }

    // Analytics
    this.trackInitiateCheckout();
  }

  private trackInitiateCheckout() {
    const formValue = this.checkoutForm?.getRawValue() || {};
    const payload = {
      event_name: 'InitiateCheckout',
      event_time: Math.floor(Date.now() / 1000),
      eventId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      action_source: 'website',
      event_source_url: typeof window !== 'undefined' && window.location ? window.location.href : '',
      user_data: {
        fn: formValue.name,
        ph: formValue.phoneNo,
        ct: this.divisions().find(d => d._id === formValue.division)?.name,
      },
      custom_data: {
        currency: '৳'
      }
    };

    if (this.gtmService.facebookPixelId && !this.gtmService.isManageFbPixelByTagManager) {
      this.gtmService.trackByFacebookPixel('InitiateCheckout', {
        currency: '৳'
      }, payload.eventId);
    }

    // Client-side Tiktok pixel
    this.gtmService.trackByTiktokPixel('InitiateCheckout', {
      currency: '৳'
    }, payload.eventId);

    this.gtmService.trackInitiateCheckout(payload as any).subscribe();
  }

  private fetchOrderForEdit(orderId: string) {
    this.isLoading.set(true);
    this.orderService.getOrderById(orderId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const order = res.data;

          // Populate Form
          this.checkoutForm.patchValue({
            name: order.name,
            phoneNo: order.phoneNo,
            address: order.shippingAddress,
            note: order.note,
            paymentMethod: order.paymentType,
          });

          // Set Courier logic
          if (order.courierData?.providerName === 'Sundarban Courier') {
            this.checkoutForm.get('courier')?.setValue('sundarban');
          }

          // Convert orderedItems to Cart format
          const tempCarts = order.orderedItems.map((item: any) => ({
            _id: Math.random().toString(), // fake cart id
            product: {
              _id: item._id,
              name: item.name,
              nameEn: item.nameEn,
              slug: item.slug,
              images: item.image ? [item.image] : [],
              salePrice: item.regularPrice || item.salePrice || item.unitPrice,
              regularPrice: item.regularPrice,
              discountType: item.discountType,
              discountAmount: item.discountAmount,
            },
            selectedQty: item.quantity,
          }));

          this.carts.set(tempCarts);
          this.updateShippingCharge();
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.uiService.wrong('Failed to load order for editing.');
        this.router.navigate(['/']);
      }
    });
  }

  private initForm() {
    this.checkoutForm = this.fb.group({
      addressType: ['home', Validators.required],
      name: ['', Validators.required],
      phoneNo: ['', [Validators.required, Validators.pattern(/^(01)[3-9][0-9]{8}$/)]],
      division: [null, Validators.required],
      area: [null, Validators.required],
      zone: [null],
      address: ['', Validators.required],
      paymentMethod: ['cash_on_delivery', Validators.required],
      deliveryChargeType: [{ value: 'inside_dhaka', disabled: true }, Validators.required],
      courier: ['standard', Validators.required],
      agreeTerms: [true, Validators.requiredTrue],
      note: ['']
    });

    // Subscribe to courier changes to handle COD disabling and same delivery charge
    this.checkoutForm.get('courier')?.valueChanges.subscribe(val => {
      const divisionId = this.checkoutForm.get('division')?.value;
      const selectedDiv = this.divisions().find(d => d._id === divisionId);
      const isDhaka = selectedDiv && (selectedDiv.name.toLowerCase().includes('dhaka') || selectedDiv.name.includes('ঢাকা'));

      if (isDhaka) {
        this.checkoutForm.get('deliveryChargeType')?.setValue('inside_dhaka');
      } else {
        this.checkoutForm.get('deliveryChargeType')?.setValue('outside_dhaka');
      }

      if (val === 'sundarban') {
        if (this.checkoutForm.get('paymentMethod')?.value === 'cash_on_delivery') {
          this.checkoutForm.get('paymentMethod')?.setValue('bkash');
          this.uiService.warn('সুন্দরবন কুরিয়ারের ক্ষেত্রে ক্যাশ অন ডেলিভারি প্রযোজ্য নয়। সম্পূর্ণ পেমেন্ট অগ্রিম করতে হবে।');
        }
      }
      this.updateShippingCharge();
    });

    // Set initial shipping charge
    this.updateShippingCharge();
  }

  private updateShippingCharge() {
    const hasFreeDelivery = this.carts().some(item => (item.product as any)?.freeDelivery === true);
    if (hasFreeDelivery) {
      this.shippingCharge.set(0);
      return;
    }

    const bookTotal = this.saleTotal();
    const courier = this.checkoutForm.get('courier')?.value;
    const type = this.checkoutForm.get('deliveryChargeType')?.value;

    let baseDelivery = 60;
    let extraCharge = 0;

    if (courier === 'sundarban') {
      baseDelivery = 60;
      const extraThousands = bookTotal > 1000 ? Math.ceil((bookTotal - 1000) / 1000) : 0;
      extraCharge = extraThousands * 15;
    } else {
      // Standard / Pathao
      if (type === 'inside_dhaka') {
        baseDelivery = 60;
        const extraThousands = bookTotal > 1000 ? Math.ceil((bookTotal - 1000) / 1000) : 0;
        extraCharge = extraThousands * 15;
      } else {
        baseDelivery = 110;
        const extraThousands = bookTotal > 1000 ? Math.ceil((bookTotal - 1000) / 1000) : 0;
        extraCharge = extraThousands * 20;
      }
    }

    this.shippingCharge.set(baseDelivery + extraCharge);
  }

  applyCoupon() {
    const code = this.couponCode()?.trim();
    if (!code) {
      this.uiService.warn('অনুগ্রহ করে কুপন কোড দিন।');
      return;
    }
    const isUser = this.userService.getUserStatus();
    this.couponService.checkCouponAvailability({ couponCode: code, subTotal: this.saleTotal() }, isUser).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.appliedCoupon.set(res.data);
          let discountVal = 0;
          if (res.data.discountType === 1 || res.data.discountType === 'percentage' || res.data.discountType === 'PERCENTAGE') {
            discountVal = Math.floor((res.data.discountAmount / 100) * this.saleTotal());
          } else {
            discountVal = Math.floor(res.data.discountAmount);
          }
          this.couponDiscount.set(discountVal);
          this.uiService.success('কুপন সফলভাবে যুক্ত হয়েছে!');
          this.updateShippingCharge();
        } else {
          this.appliedCoupon.set(null);
          this.couponDiscount.set(0);
          this.uiService.warn(res.message || 'এই কুপনটি এখন প্রযোজ্য নয়।');
        }
      },
      error: (err) => {
        this.appliedCoupon.set(null);
        this.couponDiscount.set(0);
        this.uiService.wrong(err?.error?.message || 'কুপন যাচাই করতে সমস্যা হয়েছে।');
      }
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.couponDiscount.set(0);
    this.couponCode.set('');
    this.uiService.success('কুপন বাতিল করা হয়েছে।');
    this.updateShippingCharge();
  }

  onDeliveryChargeChange(value: string) {
    this.updateShippingCharge();
  }

  private fetchCarts() {
    if (this.userService.getUserStatus()) {
      // Logged-in: fetch from server (already has full product objects)
      this.cartService.getCartByUser().subscribe(res => {
        if (res.success) {
          this.carts.set(res.data);
          this.calculateSubTotal();
        }
      });
    } else {
      // Guest: read local, then resolve product details from API
      this.fetchLocalCart();
    }
  }

  private fetchLocalCart() {
    const items = this.cartService.getCartItemFromLocalStorage();
    if (!items || items.length === 0) {
      this.carts.set([]);
      return;
    }

    const productIds = items.filter(i => !i.cartType || i.cartType === 2).map(i => i.product as string);
    const packageIds = items.filter(i => i.cartType === 1).map(i => i.specialPackage as string);

    const productObs = this.productService.getProductByIds(productIds, 'name nameEn slug regularPrice salePrice discountType discountAmount images freeDelivery isPreOrder');
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
        this.calculateSubTotal();
      },
      error: () => { }
    });
  }

  private calculateSubTotal() {
    this.updateShippingCharge();
  }

  private fetchDivisions() {
    this.divisionService.getAllDivisions({ filter: { status: 'publish' } }).subscribe(res => {
      let data = res.data.map((i: any) => ({ ...i, id: i._id }));
      data.sort((a: any, b: any) => {
        const isDhakaA = a.name.toLowerCase().includes('dhaka') || a.name.includes('ঢাকা');
        const isDhakaB = b.name.toLowerCase().includes('dhaka') || b.name.includes('ঢাকা');
        if (isDhakaA && !isDhakaB) return -1;
        if (!isDhakaA && isDhakaB) return 1;
        return a.name.localeCompare(b.name);
      });
      this.divisions.set(data);
      this.filteredDivisions.set(data);
    });
  }

  filterDivisions(query: string) {
    this.searchDistrict.set(query);
    if (!query) {
      this.filteredDivisions.set(this.divisions());
      return;
    }
    const filtered = this.divisions().filter(d => d.name.toLowerCase().includes(query.toLowerCase()));
    this.filteredDivisions.set(filtered);
  }

  filterAreas(query: string) {
    this.searchArea.set(query);
    if (!query) {
      this.filteredAreas.set(this.areas());
      return;
    }
    const filtered = this.areas().filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
    this.filteredAreas.set(filtered);
  }

  onDivisionChange(id: string) {
    const hasFreeDelivery = this.carts().some(item => (item.product as any)?.freeDelivery === true);
    const selectedDiv = this.divisions().find(d => d._id === id);
    if (selectedDiv) {
      if (selectedDiv.name.toLowerCase().includes('dhaka') || selectedDiv.name.includes('ঢাকা')) {
        this.checkoutForm.get('deliveryChargeType')?.setValue('inside_dhaka');
      } else {
        this.checkoutForm.get('deliveryChargeType')?.setValue('outside_dhaka');
      }
      this.updateShippingCharge();
    }
    if (hasFreeDelivery) {
      this.shippingCharge.set(0);
    }

    this.areaService.getAreaByParentId(id, 'name').subscribe(res => {
      const data = res.data.map((i: any) => ({ ...i, id: i._id }));
      this.areas.set(data);
      this.filteredAreas.set(data);
      this.checkoutForm.get('area')?.reset();
    });
  }

  onDivisionSelect(data: any) {
    if (data) {
      this.checkoutForm.get('division')?.setValue(data.id);
      this.onDivisionChange(data.id);
    }
  }

  onAreaSelect(data: any) {
    if (data) {
      this.checkoutForm.get('area')?.setValue(data.id);
    }
  }

  private fetchShippingCharge() {
    this.shippingService.getShippingCharge().subscribe(res => {
      if (res.data) {
        this.deliveryInDhaka.set(res.data.deliveryInDhaka || 50);
        this.deliveryOutsideDhaka.set(res.data.deliveryOutsideDhaka || 90);

        this.updateShippingCharge();
      }
    });
  }

  private fetchUserData() {
    this.userDataService.getLoggedInUserData().subscribe(res => {
      if (res && res.data) {
        const user = res.data;
        this.checkoutForm.patchValue({
          name: user.name,
          phoneNo: user.phoneNo
        });
      }
    });
  }

  onSubmit() {
    if (this.isLoading()) {
      return;
    }

    if (!this.checkoutForm.get('agreeTerms')?.value) {
      this.uiService.warn('অনুগ্রহ করে শর্তাবলী গ্রহণ করুন।');
      return;
    }

    if (this.checkoutForm.invalid) {
      this.uiService.warn('অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।');
      this.checkoutForm.markAllAsTouched();
      return;
    }

    if (!this.carts().length) {
      this.uiService.warn('কার্টে কোনো পণ্য নেই।');
      this.router.navigate(['/product-list']);
      return;
    }

    this.isLoading.set(true);

    const formValue = this.checkoutForm.getRawValue();
    const selectDivision = this.divisions().find(d => d._id === formValue.division);
    const selectArea = this.areas().find(d => d._id === formValue.area);
    const isLoggedIn = this.userService.getUserStatus();

    const carts = isLoggedIn
      ? this.carts().map(m => m._id)
      : this.carts().map(m => (m.product as Product)._id);

    const cartData = isLoggedIn
      ? []
      : this.carts().map(m => ({
        ...m,
        product: (m.product as Product)._id
      }));

    const orderedItems = this.carts().map(m => {
      const product = m.product as Product;
      return {
        _id: product._id,
        name: product.name,
        nameEn: product.nameEn,
        slug: product.slug,
        image: product.images?.length ? product.images[0] : null,
        category: {
          _id: product.category?._id,
          name: product.category?.name,
          slug: product.category?.slug,
        },
        author: Array.isArray(product.author)
          ? product.author.map((a: any) => ({ _id: a._id, name: a.name, slug: a.slug }))
          : (product.author ? [{ _id: (product.author as any)._id, name: (product.author as any).name, slug: (product.author as any).slug }] : []),
        subCategory: {
          _id: product.subCategory?._id,
          name: product.subCategory?.name,
          slug: product.category?.slug,
        },
        brand: {
          _id: product.brand?._id,
          name: product.brand?.name,
          slug: product.category?.slug,
        },
        discountType: product.discountType,
        discountAmount: product.discountAmount,
        regularPrice: this.pricePipe.transform(product, 'regularPrice'),
        unitPrice: this.pricePipe.transform(product, 'salePrice'),
        salePrice: this.pricePipe.transform(product, 'salePrice'),
        quantity: m.selectedQty,
        orderType: (product as any).isPreOrder ? 'pre_order' : 'regular',
        color: m.color ?? null,
        size: m.size ?? null,
      };
    });

    const totalDiscountAmount = this.productDiscount() + this.extraDiscount();

    const orderData = {
      name: formValue.name,
      phoneNo: formValue.phoneNo,
      shippingAddress: formValue.address,
      note: formValue.note,
      division: selectDivision,
      area: selectArea,
      zone: null,
      carts,
      cartData,
      paymentType: formValue.paymentMethod,
      country: 'bangladesh',
      paymentStatus: 'unpaid',
      orderStatus: OrderStatus.PENDING,
      orderedItems,
      orderFrom: 'Website',
      courierData: {
        providerName: formValue.courier === 'sundarban' ? 'Sundarban Courier' : 'Standard',
      },
      subTotal: this.regularTotal(),
      deliveryCharge: this.shippingCharge(),
      discount: totalDiscountAmount.toFixed(2),
      coupon: this.appliedCoupon()?._id ?? null,
      couponDiscount: this.couponDiscount(),
      totalSave: totalDiscountAmount + this.couponDiscount(),
      grandTotal: this.grandTotal(),
      discountTypes: [{ productDiscount: this.productDiscount().toFixed(2) }, { extraDiscount: this.extraDiscount() }],
      checkoutDate: this.utilsService.getDateString(new Date()),
      hasOrderTimeline: true,
      orderTimeline: {
        pending: {
          success: true,
          date: new Date(),
          expectedDate: new Date(),
        },
        confirmed: { success: false, date: null, expectedDate: null },
        processed: { success: false, date: null, expectedDate: null },
        shipped: { success: false, date: null, expectedDate: null },
        delivered: { success: false, date: null, expectedDate: null },
        canceled: { success: false, date: null, expectedDate: null },
        refunded: { success: false, date: null, expectedDate: null },
      },
    };

    this.isLoading.set(true);

    if (this.editOrderId()) {
      // Customer Edit Mode
      const customerUpdateDto = {
        name: formValue.name,
        phoneNo: formValue.phoneNo,
        shippingAddress: formValue.address,
        note: formValue.note,
        deliveryChargeType: formValue.deliveryChargeType,
        orderedItems,
      };

      this.orderService.customerEditOrder(this.editOrderId()!, customerUpdateDto).subscribe({
        next: (res) => {
          if (res.success) {
            this.uiService.success('আপনার অর্ডারটি সফলভাবে আপডেট করা হয়েছে।');
            this.router.navigate(['/account/order-details', this.editOrderId()]);
          } else {
            this.uiService.warn(res.message || 'Error occurred');
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          this.uiService.wrong('অর্ডার আপডেট করা সম্ভব হয়নি।');
          this.isLoading.set(false);
        }
      });

      return;
    }

    this.orderService.addOrder(orderData as any, isLoggedIn).subscribe({
      next: (res) => {
        if (!res.success) {
          this.uiService.warn(res.message || 'অর্ডার সম্পন্ন করা যায়নি।');
          this.isLoading.set(false);
          return;
        }

        this.uiService.success(res.message || 'আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।');
        this.reloadService.needRefreshCart$(false);
        if (!isLoggedIn) {
          const response = res as any;
          if (response.token && response.tokenExpiredIn && response.userData) {
            this.userService.manualLoginUser(response.token, response.tokenExpiredIn, response.userData._id);
          }
          this.cartService.deleteAllCartFromLocal(true);
          this.reloadService.needRefreshCart$(true);
        }

        this.trackPurchase(res.data);

        if (res.data?.providerName === 'Bkash' && res.data?.link) {
          if (typeof window !== 'undefined') {
            window.location.href = res.data.link;
          }
        } else {
          this.router.navigate(['/payment/success'], { queryParams: { orderId: res.data.orderId } });
        }

        this.isLoading.set(false);
      },
      error: () => {
        this.uiService.wrong('দুঃখিত! অর্ডারটি সম্পন্ন করা সম্ভব হয়নি।');
        this.isLoading.set(false);
      }
    });
  }

  private trackPurchase(order: any) {
    if (!order) return;
    const contents = this.carts().map(c => {
      const prod = c.product as any;
      return {
        id: prod._id,
        quantity: c.selectedQty,
        item_price: prod.salePrice
      };
    });

    const formValue = this.checkoutForm?.getRawValue() || {};

    const payload = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      eventId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      action_source: 'website',
      event_source_url: typeof window !== 'undefined' ? window.location.href : '',
      user_data: {
        fn: formValue.name,
        ph: formValue.phoneNo,
        ct: this.divisions().find(d => d._id === formValue.division)?.name,
      },
      custom_data: {
        value: this.subTotal() + this.shippingCharge() - this.extraDiscount(),
        currency: '৳',
        content_type: 'product',
        contents: contents,
        order_id: order.orderId || order._id
      }
    };

    if (this.gtmService.facebookPixelId && !this.gtmService.isManageFbPixelByTagManager) {
      this.gtmService.trackByFacebookPixel('Purchase', payload.custom_data, payload.eventId);
    }

    // Client-side Tiktok pixel
    this.gtmService.trackByTiktokPixel('PlaceAnOrder', {
      value: payload.custom_data.value,
      currency: '৳',
      content_type: 'product',
      contents: contents.map(c => ({
        content_id: c.id,
        quantity: c.quantity,
        price: c.item_price
      }))
    }, payload.eventId);

    this.gtmService.trackPurchase(payload as any).subscribe();
  }

  incrementQty(index: number) {
    const carts = [...this.carts()];
    if (carts[index]) {
      carts[index] = { ...carts[index], selectedQty: (carts[index].selectedQty || 1) + 1 };
      this.carts.set(carts);
      this.calculateSubTotal();
      if (!this.userService.getUserStatus()) {
        this.saveLocalCart(carts);
      }
    }
  }

  decrementQty(index: number) {
    const carts = [...this.carts()];
    if (carts[index] && (carts[index].selectedQty || 1) > 1) {
      carts[index] = { ...carts[index], selectedQty: (carts[index].selectedQty || 1) - 1 };
      this.carts.set(carts);
      this.calculateSubTotal();
      if (!this.userService.getUserStatus()) {
        this.saveLocalCart(carts);
      }
    }
  }

  removeItem(index: number) {
    const carts = [...this.carts()];
    carts.splice(index, 1);
    this.carts.set(carts);
    this.calculateSubTotal();
    if (!this.userService.getUserStatus()) {
      this.saveLocalCart(carts);
    }
  }

  private saveLocalCart(carts: Cart[]) {
    const raw = carts.map(c => ({
      product: typeof c.product === 'object' ? (c.product as any)?._id : c.product,
      selectedQty: c.selectedQty,
      cartType: c.cartType,
      specialPackage: c.specialPackage
    }));
    localStorage.setItem(DATABASE_KEY.userCart, JSON.stringify(raw));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
