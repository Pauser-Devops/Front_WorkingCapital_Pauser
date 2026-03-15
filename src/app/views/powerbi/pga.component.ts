import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pga',
  standalone: true,
  template: `
    <iframe 
      [src]="url"
      width="100%" 
      frameborder="0" 
      allowfullscreen="true"
      style="display:block; height:100vh; border:none;">
    </iframe>
  `
})
export class PGAComponent {
   url: SafeResourceUrl;
  constructor(private sanitizer: DomSanitizer) {
    this.url = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://app.powerbi.com/view?r=eyJrIjoiZjQzYjI0YTAtYTA0Ny00YzY4LTg0OWYtMTQwNTNhZWFmNWNjIiwidCI6IjYzNzI1YjE4LTlmMWYtNGFlZC05MmExLWIxY2QxMzllN2E1NyJ9'
    );
  }
}