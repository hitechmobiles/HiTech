import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { adminGuard, ownerGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

describe('Auth Guards', () => {
  let authService: AuthService;
  let router: Router;
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  beforeEach(() => {
    sessionStorage.removeItem('hitech_active_session');
    sessionStorage.removeItem('hitech_pending_otp');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    });
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    mockRoute = {} as ActivatedRouteSnapshot;
    mockState = { url: '/admin' } as RouterStateSnapshot;
  });

  describe('adminGuard', () => {
    it('should redirect to login when not authenticated', () => {
      spyOn(router, 'navigate');
      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/auth/login'],
        { queryParams: { returnUrl: '/admin', role: 'admin' } }
      );
    });

    it('should allow access when user is admin', async () => {
      // Login as admin
      await authService.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
      const otp = authService.lastSimulatedOtp()!;
      authService.verifyOtp(otp);

      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
      expect(result).toBeTrue();
    });
  });

  describe('ownerGuard', () => {
    it('should redirect to login when not authenticated', () => {
      spyOn(router, 'navigate');
      const ownerState = { url: '/owner' } as RouterStateSnapshot;
      const result = TestBed.runInInjectionContext(() => ownerGuard(mockRoute, ownerState));
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/auth/login'],
        { queryParams: { returnUrl: '/owner', role: 'shopowner' } }
      );
    });

    it('should allow access when user is admin (admin can access owner pages)', async () => {
      await authService.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
      const otp = authService.lastSimulatedOtp()!;
      authService.verifyOtp(otp);

      const ownerState = { url: '/owner' } as RouterStateSnapshot;
      const result = TestBed.runInInjectionContext(() => ownerGuard(mockRoute, ownerState));
      expect(result).toBeTrue();
    });
  });
});
