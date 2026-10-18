import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SeoService } from '../../services/core/seo.service';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule]
})
export class NotFoundComponent implements OnInit {
  private router = inject(Router);
  private seoService = inject(SeoService);

  ngOnInit(): void {
    if (this.router.url === '/home') {
      this.router.navigate(['/']);
      return;
    }

    this.seoService.clearSchema();
    this.seoService.updateMetaData({
      title: 'Page Not Found',
      description: 'The page you are looking for could not be found.',
      noIndex: true,
    });
  }
}
