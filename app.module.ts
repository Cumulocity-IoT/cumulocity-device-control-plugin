import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule as ngRouterModule } from '@angular/router';
import { BootstrapComponent, CoreModule, RouterModule } from '@c8y/ngx-components';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { DeviceControlWidgetModule } from './widget/device-control-widget.module';
// Translations
import './locales/de.po'; // <- adding additional strings to the german translation.
import { HttpClientModule } from '@angular/common/http';
import { DeviceControlService } from './widget/device-control.service';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
  imports: [
    BrowserAnimationsModule,
    ngRouterModule.forRoot([], { enableTracing: false, useHash: true }),
    RouterModule.forRoot(),
    CoreModule.forRoot(),
    NgSelectModule,
    DeviceControlWidgetModule,HttpClientModule
  ],
  providers: [BsModalRef,DeviceControlService],
  bootstrap: [BootstrapComponent]
})
export class AppModule {}
