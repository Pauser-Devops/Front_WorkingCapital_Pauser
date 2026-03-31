import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-ebitda',
  standalone: true,
  template: `
    <iframe 
      [src]="url"
      width="100%" 
      height="100%" 
      frameborder="0" 
      allowfullscreen="true"
      style="display:block; height:100vh;">
    </iframe>
  `
})
export class EbitdaComponent {
  url: SafeResourceUrl;
  constructor(private sanitizer: DomSanitizer) {
    this.url = this.sanitizer.bypassSecurityTrustResourceUrl(
      ''
    );
  }
}