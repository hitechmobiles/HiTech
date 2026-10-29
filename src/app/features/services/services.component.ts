import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { DistanceService, DistanceResult } from '../../core/services/distance.service';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { ServiceBookingItem, ServiceBookingRequest, ServiceFulfillmentMode } from '../../core/models/service.model';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, FormsModule, ServiceCardComponent],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit {
  dataService = inject(DataService);
  orderService = inject(OrderService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  distanceService = inject(DistanceService);
  private route = inject(ActivatedRoute);

  selectedCategory: string = 'all';
  activeBookingModal: boolean = false;
  selectedService: ServiceBookingItem | null = null;
  isCustomService: boolean = false;
  customIssueTitle: string = '';
  bookingSubmitted: boolean = false;
  confirmedBooking: ServiceBookingRequest | null = null;
  isSubmitting: boolean = false;
  isLocating: boolean = false;

  distanceResult: DistanceResult = {
    distanceKm: null,
    pickupEligible: false,
    source: 'unknown'
  };

  bookingForm = {
    deviceModel: '',
    issueDescription: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    pincode: '',
    fulfillmentMode: 'home_pickup' as ServiceFulfillmentMode,
    preferredDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    preferredTimeSlot: '10:00 AM - 01:00 PM'
  };

  readonly timeSlots = [
    '10:00 AM - 01:00 PM',
    '01:00 PM - 04:00 PM',
    '04:00 PM - 07:00 PM',
    '07:00 PM - 09:00 PM'
  ];

  get hubConfig() {
    return this.distanceService.getHubConfig();
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const srvId = params['selectedService'];
      if (srvId === 'custom' || srvId === 'srv-custom') {
        this.openCustomServiceBooking();
      } else if (srvId) {
        const found = this.dataService.services().find(s => s.id === srvId);
        if (found) {
          this.openBookingModal(found);
        }
      }
    });
  }

  get filteredServices(): ServiceBookingItem[] {
    const list = this.dataService.services();
    if (this.selectedCategory === 'all') return list;
    return list.filter(s => s.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
  }

  openBookingModal(service: ServiceBookingItem): void {
    this.isCustomService = false;
    this.customIssueTitle = '';
    this.selectedService = service;
    this.bookingSubmitted = false;
    this.confirmedBooking = null;
    this.distanceResult = { distanceKm: null, pickupEligible: false, source: 'unknown' };
    this.activeBookingModal = true;

    if (this.authService.isShopOwner()) {
      this.useShopAddress(false);
    }
  }

  openCustomServiceBooking(): void {
    this.isCustomService = true;
    this.customIssueTitle = '';
    this.selectedService = {
      id: 'srv-custom',
      name: 'Custom / Unlisted Repair Service',
      category: 'custom',
      startingPrice: 0,
      estimatedTime: 'Diagnostics: 2-4 Hours',
      warrantyPeriod: '6 Months Warranty',
      description: 'Specialized motherboard fault, IC level soldering, button/housing repair or custom issue diagnosis.',
      icon: '🔧',
      isPopular: false,
      available: true,
      includedPoints: [
        'Free doorstep diagnosis & quotation',
        'Certified Level 4 micro-soldering technician',
        'Genuine parts with 6-month warranty',
        'Full testing before device return'
      ]
    };
    this.bookingSubmitted = false;
    this.confirmedBooking = null;
    this.distanceResult = { distanceKm: null, pickupEligible: false, source: 'unknown' };
    this.activeBookingModal = true;

    if (this.authService.isShopOwner()) {
      this.useShopAddress(false);
    }
  }

  useShopAddress(showToast: boolean = true): void {
    const owner = this.authService.currentShopOwner();
    const session = this.authService.currentSession();
    if (!session || session.role !== 'shopowner') return;

    this.bookingForm.customerName = owner?.ownerName || session.name || session.shopName || '';
    if (owner?.phone) this.bookingForm.customerPhone = owner.phone;
    if (owner?.email || session.email) this.bookingForm.customerEmail = owner?.email || session.email;
    if (owner?.location) this.bookingForm.customerAddress = owner.location;

    if (owner?.location) {
      const pinMatch = owner.location.match(/\b\d{6}\b/);
      if (pinMatch) {
        this.bookingForm.pincode = pinMatch[0];
        this.onPincodeChange();
      }
    }

    if (showToast) {
      this.toastService.show('Default shop address applied to service booking!', 'success');
    }
  }

  clearAddressForClient(): void {
    this.bookingForm.customerName = '';
    this.bookingForm.customerPhone = '';
    this.bookingForm.customerEmail = '';
    this.bookingForm.customerAddress = '';
    this.bookingForm.pincode = '';
    this.distanceResult = { distanceKm: null, pickupEligible: false, source: 'unknown' };
    this.toastService.show('Cleared. Enter client address and location for repair pickup.', 'info');
  }

  closeBookingModal(): void {
    this.activeBookingModal = false;
    this.selectedService = null;
  }

  onPincodeChange(): void {
    const pin = (this.bookingForm.pincode || '').trim();
    if (pin.length === 6) {
      this.distanceResult = this.distanceService.measureFromPincode(pin);
      if (this.distanceResult.distanceKm != null) {
        if (this.distanceResult.pickupEligible) {
          this.bookingForm.fulfillmentMode = 'home_pickup';
          this.toastService.show(
            `Location verified (${this.distanceResult.distanceKm} km from hub). Home pickup is available!`,
            'success'
          );
        } else {
          this.bookingForm.fulfillmentMode = 'parcel';
          this.toastService.show(
            `Location is ${this.distanceResult.distanceKm} km from service center (> ${this.hubConfig.pickupRadiusKm} km). Please use Courier/Parcel or Store Handover.`,
            'info'
          );
        }
      } else {
        // Unknown pin coordinates
        this.toastService.show(
          'Pincode entered. If outside Chennai/hub zone (> 30 km), please choose Parcel delivery or Store Handover.',
          'info'
        );
      }
    }
  }

  async useCurrentLocation(): Promise<void> {
    this.isLocating = true;
    try {
      const res = await this.distanceService.requestBrowserLocation();
      this.distanceResult = res;
      if (res.distanceKm != null) {
        if (res.pickupEligible) {
          this.bookingForm.fulfillmentMode = 'home_pickup';
          this.toastService.show(
            `GPS location detected: ${res.distanceKm} km from hub. Doorstep pickup available!`,
            'success'
          );
        } else {
          this.bookingForm.fulfillmentMode = 'parcel';
          this.toastService.show(
            `GPS location is ${res.distanceKm} km away. Outside 30 km pickup radius. Selected Courier / Parcel delivery.`,
            'warning'
          );
        }
      } else {
        this.toastService.show('Unable to retrieve GPS coordinates. Please enter your 6-digit pincode.', 'warning');
      }
    } catch {
      this.toastService.show('Location access denied or unavailable. Please enter your pincode.', 'warning');
    } finally {
      this.isLocating = false;
    }
  }

  async submitBooking(): Promise<void> {
    if (!this.selectedService) return;

    if (!this.bookingForm.customerName.trim() || !this.bookingForm.customerPhone.trim() || !this.bookingForm.customerAddress.trim()) {
      this.toastService.show('Please fill in your Name, Phone Number, and Address.', 'warning');
      return;
    }

    if (this.bookingForm.customerPhone.trim().length < 10) {
      this.toastService.show('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    if (!this.bookingForm.pincode.trim() || this.bookingForm.pincode.trim().length !== 6) {
      this.toastService.show('Please enter a valid 6-digit Pincode to check service delivery eligibility.', 'warning');
      return;
    }

    if (this.isCustomService && !this.customIssueTitle.trim()) {
      this.toastService.show('Please specify the custom issue or repair needed.', 'warning');
      return;
    }

    if (!this.bookingForm.deviceModel.trim()) {
      this.toastService.show('Please specify your mobile phone model.', 'warning');
      return;
    }

    // Check 30 km restriction if Home Pickup is selected
    if (this.bookingForm.fulfillmentMode === 'home_pickup') {
      if (this.distanceResult.distanceKm != null && !this.distanceResult.pickupEligible) {
        this.toastService.show(
          `Your address is ${this.distanceResult.distanceKm} km away, which exceeds the ${this.hubConfig.pickupRadiusKm} km limit for home pickup. Please select Courier/Parcel or Store Handover.`,
          'danger'
        );
        return;
      }
    }

    this.isSubmitting = true;
    try {
      const srvName = this.isCustomService
        ? (this.customIssueTitle.trim() || 'Custom Repair Service')
        : this.selectedService.name;

      const res = await this.orderService.bookRepairService({
        serviceId: this.isCustomService ? 'srv-custom' : this.selectedService.id,
        serviceName: srvName,
        customIssueTitle: this.isCustomService ? this.customIssueTitle.trim() : undefined,
        deviceModel: this.bookingForm.deviceModel,
        issueDescription: this.bookingForm.issueDescription,
        customerName: this.bookingForm.customerName,
        customerPhone: this.bookingForm.customerPhone,
        customerEmail: this.bookingForm.customerEmail.trim() || undefined,
        customerAddress: this.bookingForm.customerAddress,
        pincode: this.bookingForm.pincode.trim(),
        distanceKm: this.distanceResult.distanceKm ?? undefined,
        pickupEligible: this.distanceResult.pickupEligible,
        fulfillmentMode: this.bookingForm.fulfillmentMode,
        preferredDate: this.bookingForm.preferredDate,
        preferredTimeSlot: this.bookingForm.preferredTimeSlot,
        estimatedPrice: this.isCustomService ? 0 : this.selectedService.startingPrice
      });

      if (res.success && res.booking) {
        this.confirmedBooking = res.booking;
        this.bookingSubmitted = true;
        this.toastService.show('Service appointment scheduled! Team will contact you.', 'success', 'Booking Confirmed');
      } else {
        this.toastService.show(res.message || 'Failed to submit booking', 'danger');
      }
    } catch (e) {
      this.toastService.show('Error submitting booking appointment', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }
}
