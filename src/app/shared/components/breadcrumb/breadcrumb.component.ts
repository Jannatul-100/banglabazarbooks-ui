import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

export interface BreadcrumbItem {
  label: string;
  url?: string;
  isCurrent?: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <nav class="breadcrumb-nav" aria-label="Breadcrumb">
      <div class="container">
        <ul class="breadcrumb-list">
          <li class="breadcrumb-item">
            <a routerLink="/"><i class="fa fa-home"></i> {{ 'ln.Home1' | translate }}</a>
          </li>
          <li *ngFor="let item of items()" class="breadcrumb-item" [class.active]="item.isCurrent">
            <span class="separator"><i class="fa fa-angle-right"></i></span>
            <a *ngIf="item.url && !item.isCurrent" [routerLink]="item.url">{{ item.label }}</a>
            <span *ngIf="!item.url || item.isCurrent">{{ item.label }}</span>
          </li>
        </ul>
      </div>
    </nav>
  `,
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  items = input.required<BreadcrumbItem[]>();
}
