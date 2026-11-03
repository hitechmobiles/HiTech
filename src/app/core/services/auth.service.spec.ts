import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

describe('AuthService', () => {
  let service: AuthService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.removeItem('hitech_active_session');
    sessionStorage.removeItem('hitech_pending_otp');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    });
    service = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start unauthenticated', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.userRole()).toBe('user');
  });

  it('should not be admin initially', () => {
    expect(service.isAdmin()).toBeFalse();
  });

  it('should not be shop owner initially', () => {
    expect(service.isShopOwner()).toBeFalse();
  });

  it('should have no OTP state initially', () => {
    expect(service.otpState()).toBeNull();
  });

  it('should hash password correctly', async () => {
    const hash = await service.hashPassword('test');
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
  });

  it('should reject invalid login credentials', async () => {
    const result = await service.initiateLogin('invalid@test.com', 'wrongpassword');
    expect(result.success).toBeFalse();
    expect(result.message).toContain('Invalid');
  });

  it('should generate OTP for valid admin credentials', async () => {
    const result = await service.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    expect(result.success).toBeTrue();
    expect(result.role).toBe('admin');
  });

  it('should set OTP state after successful login initiation', async () => {
    await service.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    expect(service.otpState()).toBeTruthy();
    expect(service.lastSimulatedOtp()).toBeTruthy();
  });

  it('should verify correct OTP', async () => {
    await service.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    const otp = service.lastSimulatedOtp()!;
    const result = service.verifyOtp(otp);
    expect(result.success).toBeTrue();
    expect(result.message).toContain('successful');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.isAdmin()).toBeTrue();
  });

  it('should reject incorrect OTP', async () => {
    await service.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    const result = service.verifyOtp('000000');
    expect(result.success).toBeFalse();
    expect(result.message).toContain('Invalid OTP');
  });

  it('should return error when no OTP is pending', () => {
    const result = service.verifyOtp('123456');
    expect(result.success).toBeFalse();
    expect(result.message).toContain('No OTP');
  });

  it('should logout and clear session', async () => {
    await service.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    const otp = service.lastSimulatedOtp()!;
    service.verifyOtp(otp);
    expect(service.isAuthenticated()).toBeTrue();

    spyOn(router, 'navigate');
    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should clear OTP state after successful verification', async () => {
    await service.initiateLogin('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    const otp = service.lastSimulatedOtp()!;
    service.verifyOtp(otp);
    expect(service.otpState()).toBeNull();
    expect(service.lastSimulatedOtp()).toBeNull();
  });

  it('should directly log in admin without OTP using login()', async () => {
    const result = await service.login('hitechmobilesandservice@gmail.com', 'Hitech@2026#01');
    expect(result.success).toBeTrue();
    expect(result.role).toBe('admin');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.isAdmin()).toBeTrue();
  });
});
