import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-seo-internal-links',
  standalone: true,
  imports: [RouterModule],
  template: `
    <nav class="seo-internal-links" aria-label="Related pages">
      <a routerLink="/product-list">সকল বই</a>
      <a routerLink="/author-list">লেখক তালিকা</a>
      <a routerLink="/category-list">ক্যাটাগরি</a>
      <a routerLink="/blogs">ব্লগ</a>
      <a routerLink="/activities">কার্যক্রম</a>
      <a routerLink="/offers">অফার</a>
      <a routerLink="/special-package">বিশেষ প্যাকেজ</a>
      <a routerLink="/pages/delivery-policy">ডেলিভারি নীতি</a>
      <a routerLink="/contact-us">যোগাযোগ</a>
    </nav>
  `,
  styleUrl: './seo-internal-links.component.scss',
})
export class SeoInternalLinksComponent {}
