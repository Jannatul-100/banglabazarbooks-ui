import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

import {
  LandingPage,
  LandingPageBenefitCard,
  LandingPageTrustItem,
} from '../../interfaces/common/landing-page';
import { LandingPageService } from '../../services/common/landing-page.service';
import { UiService } from '../../services/core/ui.service';
import { SeoService } from '../../services/core/seo.service';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { isInvalidPublicSlug } from '../../core/utils/html-content.util';

const DEFAULT_PRIMARY = '#3b82f6';

const DEFAULT_HERO_POINTS = [
  '২০+ পৃষ্ঠার প্র্যাকটিক্যাল গাইড',
  'বাংলায় সহজ ভাষায় লেখা',
  'Instant PDF Download',
];

const DEFAULT_HEADER_BADGES = ['100% Free', 'No Spam', 'Instant Download'];

const DEFAULT_LEAD_TRUST: LandingPageTrustItem[] = [
  { icon: 'lock', title: 'আপনার তথ্য 100% নিরাপদ', subtitle: 'আমরা আপনার তথ্য কখনোই শেয়ার করব না' },
  { icon: 'bolt', title: 'ইনস্ট্যান্ট ডাউনলোড', subtitle: 'তথ্য দেওয়ার সাথে সাথেই PDF ডাউনলোড হবে' },
  { icon: 'shield', title: 'কোনো স্প্যাম নয়', subtitle: 'শুধু গুরুত্বপূর্ণ আপডেটই পাঠানো হবে' },
];

const DEFAULT_BENEFIT_CARDS: LandingPageBenefitCard[] = [
  {
    icon: 'checklist',
    title: 'সম্পূর্ণ চেকলিস্ট',
    description: 'ডিজিটাল মার্কেটিংয়ের প্রতিটি ধাপের জন্য প্রস্তুত চেকলিস্ট',
  },
  {
    icon: 'target',
    title: 'স্টেপ বাই স্টেপ গাইড',
    description: 'কোথায় শুরু করবেন, কীভাবে এগোবেন — সব কিছু সহজ ভাষায়',
  },
  {
    icon: 'analytics',
    title: 'পারফরম্যান্স ট্র্যাকিং',
    description: 'কোন KPI ট্র্যাক করবেন, কীভাবে মাপবেন — সব ব্যাখ্যা সহ',
  },
  {
    icon: 'schedule',
    title: 'সময় সাশ্রয়ী',
    description: 'ঘণ্টার পর ঘণ্টা অনুসন্ধান না করে সরাসরি কাজ শুরু করুন',
  },
];

const DEFAULT_FOOTER_STATS = [
  { icon: 'groups', text: 'Trusted by 10,000+ Users' },
  { icon: 'verified', text: '100% Free Resource' },
  { icon: 'download', text: 'Instant Access' },
];

@Component({
  selector: 'app-landing-page-2',
  templateUrl: './landing-page-2.component.html',
  styleUrls: ['./landing-page-2.component.scss'],
  standalone: true,
  host: {
    class: 'landing-page-2-host',
    '[style.--lp2-primary]': 'primaryColor()',
    '[style.--lp2-primary-dark]': 'primaryColorDark()',
  },
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    SafeHtmlPipe,
  ],
})
export class LandingPage2Component implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly landingPageService = inject(LandingPageService);
  private readonly uiService = inject(UiService);
  private readonly seoService = inject(SeoService);
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);

  landingPage = signal<LandingPage | null>(null);
  isLoading = signal(true);
  isSubmitting = signal(false);

  leadForm = this.fb.group({
    name: ['', Validators.required],
    phoneNo: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  primaryColor = computed(
    () => this.landingPage()?.primaryColor?.trim() || DEFAULT_PRIMARY,
  );

  primaryColorDark = computed(() => this.shadeColor(this.primaryColor(), -20));

  headerBadges = computed(
    () => this.landingPage()?.headerBadges?.length
      ? this.landingPage()!.headerBadges!
      : DEFAULT_HEADER_BADGES,
  );

  heroPoints = computed(
    () => this.landingPage()?.heroPoints?.length
      ? this.landingPage()!.heroPoints!
      : DEFAULT_HERO_POINTS,
  );

  leadTrustItems = computed(
    () => this.landingPage()?.leadFormTrustItems?.length
      ? this.landingPage()!.leadFormTrustItems!
      : DEFAULT_LEAD_TRUST,
  );

  benefitCards = computed(
    () => this.landingPage()?.benefitCards?.length
      ? this.landingPage()!.benefitCards!
      : DEFAULT_BENEFIT_CARDS,
  );

  footerStats = computed(
    () => this.landingPage()?.footerStats?.length
      ? this.landingPage()!.footerStats!
      : DEFAULT_FOOTER_STATS,
  );

  isFormValid = computed(() => this.leadForm.valid);

  readonly currentYear = new Date().getFullYear();

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const subRoute = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug || isInvalidPublicSlug(slug)) {
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
          if (res.data.template !== 'v2') {
            this.router.navigate(['/landing-page', slug]);
            return;
          }
          this.landingPage.set(res.data);
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

  onSubmitLead(): void {
    if (this.leadForm.invalid || this.isSubmitting()) {
      this.leadForm.markAllAsTouched();
      return;
    }

    const page = this.landingPage();
    if (!page?.slug) {
      return;
    }

    this.isSubmitting.set(true);
    const sub = this.landingPageService
      .submitLead({
        slug: page.slug,
        ...this.leadForm.value,
      } as { slug: string; name: string; phoneNo: string; email: string })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          if (res.success) {
            this.uiService.success('ডাউনলোড শুরু হচ্ছে!');
            const url = res.data?.downloadFileUrl || page.downloadFileUrl;
            if (url && isPlatformBrowser(this.platformId)) {
              window.open(url, '_blank');
            }
            this.leadForm.reset();
          } else {
            this.uiService.warn(res.message || 'সাবমিট করা যায়নি।');
          }
        },
        error: () => {
          this.isSubmitting.set(false);
          this.uiService.wrong('সাবমিট করা যায়নি। আবার চেষ্টা করুন।');
        },
      });
    this.subscriptions.push(sub);
  }

  trustIcon(item: LandingPageTrustItem): string {
    const icon = item.icon?.trim().toLowerCase();
    if (icon === 'lock') return 'lock';
    if (icon === 'bolt') return 'bolt';
    if (icon === 'shield') return 'shield';
    if (icon === 'verified') return 'verified';
    if (icon === 'groups') return 'groups';
    if (icon === 'download') return 'download';
    return icon || 'check_circle';
  }

  trustToneClass(index: number): string {
    const tones = [
      'lp2-trust-list__icon lp2-trust-list__icon--green',
      'lp2-trust-list__icon lp2-trust-list__icon--blue',
      'lp2-trust-list__icon lp2-trust-list__icon--purple',
    ];
    return tones[index % tones.length];
  }

  benefitIcon(card: LandingPageBenefitCard): string {
    const icon = card.icon?.trim().toLowerCase();
    if (icon === 'checklist') return 'checklist';
    if (icon === 'target') return 'track_changes';
    if (icon === 'analytics') return 'bar_chart';
    if (icon === 'schedule') return 'schedule';
    return icon || 'star';
  }

  private updateSeo(page: LandingPage): void {
    this.seoService.updateMetaData({
      title: page.seoTitle || page.title || page.name,
      description: page.seoDescription || page.subtitle || '',
      image: page.heroImage,
      canonicalPath: `/landing-page-2/${page.slug}`,
    });

    this.seoService.setWebPageSchema(
      `/landing-page-2/${page.slug}`,
      page.seoTitle || page.title || page.name || 'Free Resource',
      [{ label: page.title || page.name || 'Free Resource', isCurrent: true }],
    );
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
