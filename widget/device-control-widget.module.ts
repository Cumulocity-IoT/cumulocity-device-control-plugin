/**
 * /*
 * Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @format
 */

import { CoreModule, CommonModule, HOOK_COMPONENTS } from "@c8y/ngx-components";
import { DeviceControlWidgetConfig } from "./device-control-widget.config.component";
import { DeviceControlWidget } from "./device-control-widget.component";
import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { NgSelectModule } from "@ng-select/ng-select";
import { SafeImage } from "./safeImage.pipe";
import { MatTableModule } from "@angular/material/table";
import { DeviceControlService } from "./device-control.service";

import { MatSortModule } from '@angular/material/sort';
@NgModule({
    imports: [CoreModule, CommonModule, HttpClientModule, NgSelectModule, MatTableModule,MatSortModule,],
    declarations: [DeviceControlWidget, DeviceControlWidgetConfig, SafeImage],
    entryComponents: [DeviceControlWidget, DeviceControlWidgetConfig],
    providers: [
        DeviceControlService,
        {
            provide: HOOK_COMPONENTS,
            multi: true,
            useValue: {
                id: "global.presales.device.control.widget.widget",
                label: "Device Control Widget",
                description: "widget to show devices status and allow operations to be performed.",
                component: DeviceControlWidget,
                configComponent: DeviceControlWidgetConfig,
                previewImage: require("@widget-assets/img-preview.png"),
                data: {
                    ng1: {
                        options: { noDeviceTarget: true, noNewWidgets: false, deviceTargetNotRequired: true, groupsSelectable: true },
                    },
                },
            },
        },
    ],
})
export class DeviceControlWidgetModule { }
