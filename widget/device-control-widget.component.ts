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

import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { OperationService, OperationStatus, IOperation, IManagedObject, InventoryService } from '@c8y/client';
import { WidgetHelper } from "./widget-helper";
import { WidgetConfig, DeviceOperation } from "./widget-config";
import * as _ from 'lodash';
import { Observable, Subscription, interval, Subject, fromEvent, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, tap } from 'rxjs/operators';
import { AlertService } from '@c8y/ngx-components';
import { Realtime } from '@c8y/ngx-components/api';

@Component({
    selector: "lib-device-control-widget",
    templateUrl: "./device-control-widget.component.html",
    styleUrls: ["./device-control-widget.component.css"],
})
export class DeviceControlWidget implements OnDestroy, OnInit {

    widgetHelper: WidgetHelper<WidgetConfig>;
    @Input() config;

    @ViewChild('assetfilter', { static: true }) filterInput: ElementRef;

    private timerObs: Observable<number>;
    private subs: Subscription[] = [];
    public input$ = new Subject<string | null>();
    public moSubs$ = new BehaviorSubject<any | null>(null);



    constructor(private realtime: Realtime, private operations: OperationService, private inventoryService: InventoryService, private alertService: AlertService) {

    }

    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        await this.updateDeviceStates(true); //all devices
        this.timerObs = interval(60000);

        this.subs.push(fromEvent(this.filterInput.nativeElement, 'keyup')
            .pipe(
                debounceTime(200),
                map((e: any) => e.target.value),
                distinctUntilChanged(),
                tap((c: string) => {
                    this.widgetHelper.getWidgetConfig().deviceFilter = c;
                    //console.log("search", this.widgetHelper.getWidgetConfig().deviceFilter);
                    this.updateDeviceStates();
                })
            )
            .subscribe()
        );

        this.subs.push(this.moSubs$.subscribe(data => {
            if (data) {
                this.updateDevice(data);
            }
        }));

        return;
    }

    async performOperation(mo: IManagedObject, op: DeviceOperation): Promise<void> {
        //let ops: IResult<IOperation> = await this.operations.detail('37661367');

        if (op.toggle) {
            //update the managed object to set the flag to the opposite of what it is currently
            //console.log("INCOMING", mo);
            let flag: boolean = false;
            if (_.has(mo, op.source)) {
                //console.log("FLAG", !mo[op.source]);
                flag = !mo[op.source];
            }

            const partialUpdateObject: Partial<IManagedObject> = {
                id: `${mo.id}`,
            };
            partialUpdateObject[op.source] = flag;
            const { data, res } = await this.inventoryService.update(partialUpdateObject);

            if (res.status === 200) {
                this.alertService.success(`operation ${op.name} for ${mo.name} successful`);
                mo[op.source] = data[op.source];
            } else {
                let reason = await res.text();
                this.alertService.danger(`operation ${op.name} for ${mo.name} failed, reason: ${reason}`);
            }


        } else {
            try {
                //There needs to be a minimum of 
                // "com_cumulocity_model_Agent": {},
                // so that the object can recieve operations. 
                if (!_.has(mo, 'com_cumulocity_model_Agent')) {
                    const partialUpdateObject: Partial<IManagedObject> = {
                        id: `${mo.id}`,
                    };
                    partialUpdateObject['com_cumulocity_model_Agent'] = {};
                    let { data, res } = await this.inventoryService.update(partialUpdateObject);
                }


                //Now we can try to send this.
                //console.log(op.payload);
                let payload = JSON.parse(op.payload);
                //console.log(payload);

                let operation: IOperation = {
                    deviceId: mo.id,
                    id: op.operation,
                };
                operation[op.operation] = payload;
                //console.log("operation", operation);

                let { data, res } = await this.operations.create(operation);
                //console.log("operation res", res);

                if (res.status >= 200 && res.status < 300) {

                    if (data.status) {
                        if (data.status == OperationStatus.SUCCESSFUL) {
                            this.alertService.success(`operation ${op.name} for ${mo.name} is ${data.status}`);
                        } else if (data.status == OperationStatus.PENDING || data.status == OperationStatus.PENDING) {
                            this.alertService.success(`operation ${op.name} for ${mo.name} is ${data.status}`);
                        } else {
                            this.alertService.danger(`operation ${op.name} for ${mo.name} is ${data.status}`);
                        }
                    } else {
                        this.alertService.success(`operation ${op.name} for ${mo.name} run`);
                    }
                } else {
                    this.alertService.danger(`operation ${op.name} for ${mo.name} failed, reason: ${res}`);
                }
                //console.log("RESP", data);

            } catch (e) {
                //console.log("ERROR", e);
                this.alertService.danger(`operation ${op.name} for ${mo.name} failed, reason: ${e}`);
            }
        }
    }

    ngOnDestroy(): void {
        //unsubscribe from observables here
        this.subs.forEach(s => s.unsubscribe());
    }

    async updateDevice(mo: any): Promise<void> {
        //console.log("moSubs", mo);
        return;
    }

    async updateDeviceStates(makeCall: boolean = false): Promise<void> {
        //here we just update the objects to refect their current state. 
        let ids: string[] = this.widgetHelper.getWidgetConfig().assets.map(mo => mo.id);

        if (makeCall) {
            this.widgetHelper.getWidgetConfig().assets = await this.widgetHelper.getDevices(this.inventoryService, ids);
        }

        //console.log("UPDATE", this.widgetHelper.getWidgetConfig().assets, this.widgetHelper.getWidgetConfig().atRisk, this.widgetHelper.getWidgetConfig().deviceFilter);


        //filter at risk
        this.widgetHelper.getWidgetConfig().filteredAssets = this.widgetHelper.getWidgetConfig().assets.filter(mo => {
            if (!this.widgetHelper.getWidgetConfig().atRisk) {
                return true; //allow all
            }
            return this.deviceAtRisk(mo);
        });

        //filter names
        this.widgetHelper.getWidgetConfig().filteredAssets = this.widgetHelper.getWidgetConfig().filteredAssets.filter(mo => {
            if (this.widgetHelper.getWidgetConfig().deviceFilter === undefined || this.widgetHelper.getWidgetConfig().deviceFilter === '') {
                return true;
            }

            // let ExternalIdMatch = _.has(mo, "externalId") && mo.externalId.toLowerCase().indexOf(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase()) !== -1;
            // let statusMatch = _.has(mo, "c8y_Availability") && _.has(mo["c8y_Availability"], "status") && mo["c8y_Availability"]["status"].toLowerCase().indexOf(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase()) !== -1;
            // return ExternalIdMatch || statusMatch || mo.name.toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase());
            return mo.name.toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase());
        });

        this.widgetHelper.getWidgetConfig().filteredAssets = this.widgetHelper.getWidgetConfig().filteredAssets.sort((a, b) => a.name.localeCompare(b.name));
        return;
    }

    deviceAtRisk(mo: IManagedObject): boolean {
        let r = false; //default - no filter
        if (_.has(mo, "c8y_Availability")) {
            let s = mo["c8y_Availability"].status;
            r = true;
            if (s === "AVAILABLE") {
                r = false;
                if (_.has(mo, "sag_IsShutDown") && mo["sag_IsShutDown"] == true) {
                    r = true;
                }
            }
        }

        //other elements to check - connected?
        if (_.has(mo, "c8y_Connection")) {
            let s = mo["c8y_Availability"].status;
            r = r || s == "DISCONNECTED";
        }


        //alarms are risk if they are active
        r = r || this.widgetHelper.getWidgetConfig().getAlarmCount(mo) > 0;
        return r;
    }

}

