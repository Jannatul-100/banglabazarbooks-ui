import { Component, OnInit, inject, ViewChild, ElementRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OtpService } from '../../../services/common/otp.service';
import { UserService } from '../../../services/common/user.service';
import { UiService } from '../../../services/core/ui.service';
import { UtilsService } from '../../../services/core/utils.service';
import { environment } from '../../../../environments/environment';
import { User } from '../../../interfaces/common/user.interface';
import { StorageService } from '../../../services/core/storage.service';
import { DATABASE_KEY } from '../../../core/utils/global-variable';
import { SeoService } from '../../../services/core/seo.service';

declare var FB: any;

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ]
})
export class RegistrationComponent implements OnInit {
  // Google login
  @ViewChild('googleLoginRef', { static: true }) loginElement!: ElementRef;

  // Data Form
  dataForm!: FormGroup;
  isPasswordShow = false;
  isLoading = false;
  isOtpSent = false;
  countdown = 0;
  navigateFrom: string | null = null;
  auth2: any;

  // Dependencies
  private fb = inject(FormBuilder);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private userService = inject(UserService);
  private uiService = inject(UiService);
  private otpService = inject(OtpService);
  private utilsService = inject(UtilsService);
  private storageService = inject(StorageService);
  private platformId = inject(PLATFORM_ID);
  private seoService = inject(SeoService);

  private timerInstance: any;

  ngOnInit(): void {
    this.seoService.clearSchema();
    this.seoService.updateMetaData({
      title: 'রেজিস্ট্রেশন করুন - বাংলা বাজার বুকসস',
      noIndex: true
    });
    this.initDataForm();
    this.activatedRoute.queryParamMap.subscribe(params => {
      this.navigateFrom = params.get('navigateFrom');
    });

    if (isPlatformBrowser(this.platformId)) {
      this.sdkManager();
    }
  }

  private initDataForm() {
    this.dataForm = this.fb.group({
      name: [null, Validators.required],
      username: [null, [Validators.required]],
      password: [null, [Validators.required, Validators.minLength(6)]],
      otp: [null],
      isAccept: [false, Validators.requiredTrue]
    });
  }

  get name() { return this.dataForm.get('name'); }
  get username() { return this.dataForm.get('username'); }
  get password() { return this.dataForm.get('password'); }

  onShowPassword() {
    this.isPasswordShow = !this.isPasswordShow;
  }

  onSendOtp() {
    const username = this.dataForm.get('username')?.value;
    if (!username) {
      this.uiService.warn('অনুগ্রহ করে ইউজারনেম (ইমেইল/ফোন) প্রদান করুন।');
      return;
    }

    this.isLoading = true;
    const isEmail = this.utilsService.validateEmail(username);

    const obs = isEmail
      ? this.otpService.generateOtpWithEmail(username)
      : this.otpService.generateOtpWithPhoneNo(username);

    obs.subscribe({
      next: (res) => {
        if (res.success) {
          this.isOtpSent = true;
          this.startCountdown(60);
          this.uiService.success(res.message || 'OTP sent');
        } else {
          this.uiService.warn(res.message || 'Error');
        }
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  private startCountdown(seconds: number) {
    this.countdown = seconds;
    if (this.timerInstance) clearInterval(this.timerInstance);
    this.timerInstance = setInterval(() => {
      if (this.countdown > 0) {
        this.countdown--;
      } else {
        clearInterval(this.timerInstance);
      }
    }, 1000);
  }

  onSubmit() {
    if (this.dataForm.invalid) {
      this.uiService.warn('অনুগ্রহ করে সকল সঠিক তথ্য প্রদান করুন।');
      return;
    }

    if (!this.isOtpSent) {
      this.onSendOtp();
      return;
    }

    this.onSubmitData();
  }

  onSubmitData() {
    this.isLoading = true;
    const formData = this.dataForm.value;
    const isEmail = this.utilsService.validateEmail(formData.username);

    const validateObs = isEmail
      ? this.otpService.validateOtpWithEmail({ email: formData.username, code: formData.otp })
      : this.otpService.validateOtpWithPhoneNo({ phoneNo: formData.username, code: formData.otp });

    validateObs.subscribe({
      next: (res) => {
        if (res.success) {
          const user = {
            name: formData.name,
            username: formData.username,
            password: formData.password,
            registrationType: isEmail ? 'email' : 'phone',
            hasAccess: true
          };
          this.userService.userSignupAndLogin(user as any, this.navigateFrom || undefined);
        } else {
          this.uiService.warn(res.message || 'Validation failed');
          this.isLoading = false;
        }
      },
      error: () => this.isLoading = false
    });
  }

  private checkUserForRegistration(data: User) {
    this.userService.checkUserForRegistration(data.username!).subscribe({
      next: (res) => {
        if (res.data.hasUser) {
          this.userService.userSignupAndLoginSocial(data, this.navigateFrom || undefined);
        } else {
          this.storageService.storeDataToSessionStorage(DATABASE_KEY.signUpHoldData, data);
          this.router.navigate(['/complete-registration'], {
            queryParams: { navigateFrom: this.navigateFrom },
            queryParamsHandling: 'merge',
          });
        }
      },
      error: (err) => console.log(err),
    });
  }

  async sdkManager() {
    (<any>window)['googleSDKLoaded'] = () => {
      (<any>window)['gapi'].load('auth2', () => {
        this.auth2 = (<any>window)['gapi'].auth2.init({
          client_id: environment.googleClientId,
          plugin_name: 'login',
          cookiepolicy: 'single_host_origin',
          scope: 'profile email',
        });
        this.signUpAndLoginWithGoogle();
      });
    };
    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) { return; }
      js = d.createElement('script');
      js.id = id;
      js.src = 'https://apis.google.com/js/platform.js?onload=googleSDKLoaded';
      fjs?.parentNode?.insertBefore(js, fjs);
    })(document, 'script', 'google-jssdk');
  }

  signUpAndLoginWithGoogle() {
    if (this.auth2) {
      this.auth2.attachClickHandler(
        this.loginElement.nativeElement,
        {},
        (googleAuthUser: any) => {
          let profile = googleAuthUser.getBasicProfile();
          const user: any = {
            name: profile.getName(),
            username: profile.getId(),
            profileImg: profile.getImageUrl(),
            email: profile.getEmail() ? profile.getEmail() : null,
            hasAccess: true,
            registrationType: 'google',
            userFrom: 'Online',
          };
          this.checkUserForRegistration(user);
        },
        (error: any) => {
          console.log(error);
          this.uiService.warn('Something went wrong, Please Clear Your Browser Data.');
        }
      );
    }
  }
}
