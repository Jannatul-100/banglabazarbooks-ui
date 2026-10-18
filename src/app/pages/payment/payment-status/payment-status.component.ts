import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { SeoService } from '../../../services/core/seo.service';
import { UserService } from '../../../services/common/user.service';
import { OrderService } from '../../../services/common/order.service';

@Component({
  selector: 'app-payment-status',
  templateUrl: './payment-status.component.html',
  styleUrls: ['./payment-status.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, TranslateModule]
})
export class PaymentStatusComponent implements OnInit {
  // Signals
  status = signal<'success' | 'fail' | 'cancel'>('success');
  orderId = signal<string | null>(null);
  failMessage = signal<string | null>(null);

  // Dependencies
  private route = inject(ActivatedRoute);
  private seoService = inject(SeoService);
  private userService = inject(UserService);
  private orderService = inject(OrderService);

  orderCount = signal<number>(0);
  orderTimeline = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  get progressWidth(): string {
    const count = Math.min(10, this.orderCount());
    if (count <= 1) return '0%';
    return ((count - 1) / 9) * 100 + '%';
  }

  ngOnInit(): void {
    this.seoService.clearSchema();
    this.seoService.updateMetaData({ title: 'Payment Status', noIndex: true });
    const path = this.route.snapshot.url.map(segment => segment.path).join('/');
    if (path.includes('success')) this.status.set('success');
    else if (path.includes('fail')) this.status.set('fail');
    else if (path.includes('cancel')) this.status.set('cancel');

    this.orderId.set(this.route.snapshot.queryParamMap.get('orderId'));
    this.failMessage.set(this.route.snapshot.queryParamMap.get('message'));

    if (this.status() === 'success') {
      if (this.userService.getUserStatus()) {
        this.fetchOrderCount();
      } else {
        // Since we auto-login, this should theoretically not happen, but wait for userStatusListener
        this.userService.userStatusListener.subscribe(status => {
          if (status) {
            this.fetchOrderCount();
          }
        });
      }
    }
  }

  fetchOrderCount() {
    this.orderService.getOrdersByUser({
      pagination: { pageSize: 1, currentPage: 0 },
      filter: { orderStatus: 5 } // 5 = DELIVERED
    }).subscribe({
      next: (res) => {
        if (res.success && res.count !== undefined) {
          this.orderCount.set(res.count);
          console.log('User delivered order count fetched:', res.count);
        }
      },
      error: (err) => {
        console.error('Error fetching order count:', err);
      }
    });
  }

  getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }
}
