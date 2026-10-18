import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Order } from '../../../../interfaces/common/order.interface';
import { OrderStatus } from '../../../../enum/order.enum';
import { OrderService } from '../../../../services/common/order.service';

@Component({
  selector: 'app-order-track',
  templateUrl: './order-track.component.html',
  styleUrls: ['./order-track.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule
  ]
})
export class OrderTrackComponent implements OnInit, OnDestroy {
  // Signals
  order = signal<Order | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  hasSearched = signal<boolean>(false);

  // Search input models
  searchOrderId = '';
  searchPhoneNo = '';

  // Public Enums for Template
  public OrderStatusEnum = OrderStatus;

  // Dependencies
  private orderService = inject(OrderService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const subRoute = this.activatedRoute.paramMap.subscribe(params => {
      const id = params.get('orderId'); // This is _id
      if (id) {
        this.fetchOrderDetails(id);
      }
    });

    const subQuery = this.activatedRoute.queryParamMap.subscribe(qParams => {
      const orderId = qParams.get('orderId');
      const phoneNo = qParams.get('phoneNo');
      if (orderId && phoneNo) {
        this.searchOrderId = orderId;
        this.searchPhoneNo = phoneNo;
        this.fetchTrackOrder(orderId, phoneNo);
      }
    });

    this.subscriptions.push(subRoute, subQuery);
  }

  onTrackSubmit(): void {
    const cleanOrderId = this.searchOrderId?.trim();
    const cleanPhoneNo = this.searchPhoneNo?.trim();

    if (!cleanOrderId || !cleanPhoneNo) {
      this.errorMessage.set('অনুগ্রহ করে Order ID এবং ফোন নম্বর উভয়ই প্রদান করুন।');
      return;
    }

    this.fetchTrackOrder(cleanOrderId, cleanPhoneNo);

    this.router.navigate(['/track-order'], {
      queryParams: {
        orderId: cleanOrderId,
        phoneNo: cleanPhoneNo
      }
    });
  }

  private fetchTrackOrder(orderId: string, phoneNo: string) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.hasSearched.set(true);
    const sub = this.orderService.trackOrder(orderId.trim(), phoneNo.trim()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.order.set(res.data);
          this.errorMessage.set(null);
        } else {
          this.order.set(null);
          this.errorMessage.set(res.message || 'অর্ডারটি খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক Order ID এবং ফোন নম্বর দিন।');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.order.set(null);
        this.errorMessage.set(err?.error?.message || 'অর্ডার ট্র্যাকিং করা সম্ভব হয়নি। সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।');
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(sub);
  }

  private fetchOrderDetails(orderId: string) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.hasSearched.set(true);
    const sub = this.orderService.getOrderById(orderId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.order.set(res.data);
          this.errorMessage.set(null);
        } else {
          this.order.set(null);
          this.errorMessage.set(res.message || 'অর্ডারের বিবরণ পাওয়া যায়নি।');
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.order.set(null);
        this.errorMessage.set('অর্ডারের বিবরণ লোড করা যায়নি।');
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
