import { ApplicationConfig, provideZonelessChangeDetection, importProvidersFrom, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withHashLocation } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { registerLocaleData } from '@angular/common';
import localeBn from '@angular/common/locales/bn';

registerLocaleData(localeBn, 'bn');

import { routes } from './app.routes';

import { MatDialogModule } from '@angular/material/dialog';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      // withHashLocation()
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({ includePostRequests: true })
    ),
    importProvidersFrom(MatDialogModule),
    provideTranslateService({
      fallbackLang: 'bn'
    }),
    provideTranslateHttpLoader({
      prefix: '/i18n/',
      suffix: '.json'
    })
  ]
};
