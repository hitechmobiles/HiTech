import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss']
})
export class LoadingSpinnerComponent {
  @Input() message: string = 'Loading certified catalog from cloud...';
  @Input() subMessage: string = 'Connecting to real-time inventory and retrieving media';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() fullPage: boolean = false;
  @Input() inline: boolean = false;
}
