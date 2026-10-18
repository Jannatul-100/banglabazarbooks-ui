import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { OrderStatus } from '../../../../enum/order.enum';
import { Order } from '../../../../interfaces/common/order.interface';
import { Product } from '../../../../interfaces/common/product';
import { OrderService } from '../../../../services/common/order.service';
import { ProductService } from '../../../../services/common/product.service';
import { UiService } from '../../../../services/core/ui.service';
import { EngBnNumPipe } from '../../../../shared/pipes/eng-bn-num.pipe';
import { PricePipe } from '../../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-order-details',
  templateUrl: './order-details.component.html',
  styleUrls: ['./order-details.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    ReactiveFormsModule,
    EngBnNumPipe,
    MatButtonModule,
    MatDividerModule,
    MatAutocompleteModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule
  ]
})
export class OrderDetailsComponent implements OnInit, OnDestroy {
  // Signals
  order = signal<Order | null>(null);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  estimatedDeliveryDate = computed(() => {
    const checkoutDate = this.order()?.checkoutDate;
    if (!checkoutDate) {
      return null;
    }
    const date = new Date(checkoutDate);
    date.setDate(date.getDate() + 3);
    return date;
  });
  
  // Edit State
  isEditing = signal<boolean>(false);
  editItems = signal<any[]>([]);
  productSearchControl = new FormControl('');
  searchResults = signal<Product[]>([]);
  isSearchingProduct = signal<boolean>(false);

  editSubTotal = computed(() => {
    return this.editItems().reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  });

  editGrandTotal = computed(() => {
    const deliveryCharge = this.order()?.deliveryCharge || 0;
    // For simplicity we aren't displaying dynamic discounts yet, just standard prices
    return this.editSubTotal() + deliveryCharge;
  });

  // Public Enums for Template
  public OrderStatusEnum = OrderStatus;

  // Dependencies
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private uiService = inject(UiService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const subRoute = this.activatedRoute.paramMap.subscribe(params => {
      const orderId = params.get('orderId');
      if (orderId) {
        this.fetchOrderDetails(orderId);
      }
    });
    this.subscriptions.push(subRoute);

    // Setup product search listener
    this.subscriptions.push(
      this.productSearchControl.valueChanges.pipe(
        debounceTime(400),
        distinctUntilChanged()
      ).subscribe(val => {
        if (typeof val === 'string' && val.trim().length > 1) {
          this.searchProducts(val.trim());
        } else {
          this.searchResults.set([]);
        }
      })
    );
  }

  private fetchOrderDetails(orderId: string) {
    this.isLoading.set(true);
    this.orderService.getOrderById(orderId).subscribe({
      next: (res) => {
        if (res.success) {
          this.order.set(res.data);
          this.isEditing.set(false); // Reset edit state if fetched
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  getTimelineStatus(status: OrderStatus): boolean {
    const o = this.order();
    if (!o || !o.orderTimeline) return false;

    switch(status) {
      case OrderStatus.PENDING: return true; // Always true if order exists
      case OrderStatus.CONFIRM: return !!o.orderTimeline.confirmed?.success;
      case OrderStatus.PROCESSING: return !!o.orderTimeline.processed?.success;
      case OrderStatus.SHIPPING: return !!o.orderTimeline.shipped?.success;
      case OrderStatus.DELIVERED: return !!o.orderTimeline.delivered?.success;
      case OrderStatus.CANCEL: return !!o.orderTimeline.canceled?.success;
      case OrderStatus.REFUND: return !!o.orderTimeline.refunded?.success;
      default: return false;
    }
  }

  onEditOrder() {
    const o = this.order();
    if (o && o.orderStatus === OrderStatus.PENDING) {
      this.isEditing.set(true);
      // Deep copy ordered items to allow modification
      this.editItems.set(JSON.parse(JSON.stringify(o.orderedItems)));
    }
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editItems.set([]);
    this.productSearchControl.setValue('');
  }

  incrementQty(index: number) {
    const items = [...this.editItems()];
    items[index].quantity += 1;
    this.editItems.set(items);
  }

  decrementQty(index: number) {
    const items = [...this.editItems()];
    if (items[index].quantity > 1) {
      items[index].quantity -= 1;
      this.editItems.set(items);
    }
  }

  removeItem(index: number) {
    const items = [...this.editItems()];
    items.splice(index, 1);
    this.editItems.set(items);
  }

  searchProducts(query: string) {
    this.isSearchingProduct.set(true);
    
    const mSelect = {
      name: 1, nameEn: 1, slug: 1, images: 1, salePrice: 1, regularPrice: 1, discountType: 1, discountAmount: 1, quantity: 1, author: 1, publisher: 1, category: 1
    };

    const filter = {
      filter: { status: 'publish' },
      pagination: {
        pageSize: 10,
        currentPage: 0
      },
      select: mSelect
    };
    
    this.productService.getAllProducts(filter, query).subscribe({
      next: (res: any) => {
        if (res.data) {
          this.searchResults.set(res.data);
        }
        this.isSearchingProduct.set(false);
      },
      error: () => {
        this.isSearchingProduct.set(false);
      }
    });
  }

  onAddProduct(product: any) {
    if (product.quantity <= 0) {
      this.uiService.warn('দুঃখিত, বইটি স্টকে নেই।');
      return;
    }

    const items = [...this.editItems()];
    const existingIndex = items.findIndex(item => item._id === product._id);
    
    if (existingIndex > -1) {
      items[existingIndex].quantity += 1;
    } else {
      items.push({
        _id: product._id,
        name: product.name,
        nameEn: product.nameEn,
        slug: product.slug,
        image: product.image || product.images?.[0] || null,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        unitPrice: product.salePrice,
        quantity: 1,
        category: product.category,
        author: product.author?.[0], // Assuming first author for simplicity
        publisher: product.publisher,
        discountType: product.discountType,
        discountAmount: product.discountAmount
      });
    }

    this.editItems.set(items);
    this.productSearchControl.setValue('');
    this.searchResults.set([]);
    this.uiService.success(`${product.name} যোগ করা হয়েছে।`);
  }

  saveChanges() {
    const o = this.order();
    if (!o) return;
    
    const currentItems = this.editItems();
    if (currentItems.length === 0) {
      this.uiService.warn('অর্ডারে কমপক্ষে একটি বই থাকতে হবে।');
      return;
    }

    this.isSaving.set(true);
    const payload = {
      name: o.name,
      phoneNo: o.phoneNo,
      email: o.email || '',
      shippingAddress: o.shippingAddress,
      paymentType: o.paymentType || 'Cash on Delivery',
      paymentStatus: o.paymentStatus || 'unpaid',
      orderStatus: o.orderStatus,
      subTotal: o.subTotal,
      deliveryCharge: o.deliveryCharge,
      discount: o.discount || 0,
      grandTotal: o.grandTotal,
      orderedItems: currentItems
    };

    this.orderService.customerEditOrder(o._id as string, payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        if (res.success) {
          this.uiService.success('অর্ডার আপডেট করা হয়েছে।');
          this.isEditing.set(false);
          this.fetchOrderDetails(o._id as string); // Refresh order details
        } else {
          this.uiService.wrong(res.message || 'Error occurred');
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        console.log(err);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
