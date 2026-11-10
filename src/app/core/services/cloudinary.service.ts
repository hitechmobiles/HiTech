import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resource_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private http = inject(HttpClient);
  private cloudName = environment.cloudinary.cloudName;

  /**
   * Directly upload a product gallery image using Unsigned Preset
   */
  async uploadImage(file: File): Promise<CloudinaryUploadResponse> {
    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinary.productPreset);

    return await firstValueFrom(
      this.http.post<CloudinaryUploadResponse>(url, formData)
    );
  }

  /**
   * Directly upload an offer promotional video using Unsigned Preset
   */
  async uploadVideo(file: File): Promise<CloudinaryUploadResponse> {
    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinary.offerPreset);

    return await firstValueFrom(
      this.http.post<CloudinaryUploadResponse>(url, formData)
    );
  }

  /**
   * Helper to build auto-optimized, responsive WebP/AVIF Cloudinary delivery URLs
   */
  getOptimizedUrl(
    publicIdOrUrl: string,
    options: { width?: number; height?: number; crop?: string; quality?: string } = {}
  ): string {
    if (!publicIdOrUrl) return '';

    // If it's already a full Cloudinary URL, inject transformations
    if (publicIdOrUrl.includes('res.cloudinary.com')) {
      const transform = `f_auto,q_${options.quality || 'auto'}${options.width ? ',w_' + options.width : ''}${options.height ? ',h_' + options.height : ''},c_${options.crop || 'limit'}`;
      return publicIdOrUrl.replace('/upload/', `/upload/${transform}/`);
    }

    // If it's a raw public ID
    const { width = 800, height, crop = 'limit', quality = 'auto' } = options;
    const transform = `f_auto,q_${quality},w_${width}${height ? ',h_' + height : ''},c_${crop}`;
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transform}/${publicIdOrUrl}`;
  }

  /**
   * Generate video poster thumbnail URL at timestamp 0s
   */
  getVideoPosterUrl(videoPublicId: string, width: number = 720): string {
    return `https://res.cloudinary.com/${this.cloudName}/video/upload/so_0,f_jpg,q_auto,w_${width}/${videoPublicId}.jpg`;
  }
}

