import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './auth-login.component.html',
  styleUrls: ['./auth-login.component.scss']
})
export class AuthLoginComponent implements OnInit {
  authService = inject(AuthService);
  toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  selectedRole: 'admin' | 'shopowner' = 'admin';
  email: string = '';
  password: string = '';
  isSubmitting: boolean = false;
  returnUrl: string = '';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['role'] === 'shopowner') {
        this.selectedRole = 'shopowner';
      } else {
        this.selectedRole = 'admin';
      }
      this.returnUrl = params['returnUrl'] || '';
    });
  }

  setRole(role: 'admin' | 'shopowner'): void {
    this.selectedRole = role;
  }

  async handleLogin(): Promise<void> {
    if (!this.email.trim() || !this.password.trim()) {
      this.toastService.show('Please enter both email and password.', 'warning');
      return;
    }

    this.isSubmitting = true;
    try {
      const res = await this.authService.login(this.email, this.password);
      if (res.success) {
        this.toastService.show(res.message, 'success', 'Login Successful');
        if (this.returnUrl) {
          this.router.navigateByUrl(this.returnUrl);
        } else if (res.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/owner']);
        }
      } else {
        this.toastService.show(res.message, 'danger', 'Authentication Failed');
      }
    } catch (e) {
      this.toastService.show('Login request error', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }
}
