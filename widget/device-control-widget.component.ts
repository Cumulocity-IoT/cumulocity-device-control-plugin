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
import { OperationService, OperationStatus, IOperation, IManagedObject, InventoryService, InventoryBinaryService, ApplicationService } from '@c8y/client';
import { WidgetHelper } from "./widget-helper";
import { WidgetConfig, DeviceOperation } from "./widget-config";
import * as _ from 'lodash';
import { Observable, Subscription, interval, Subject, fromEvent, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, tap } from 'rxjs/operators';
import { AlertService } from '@c8y/ngx-components';
import { Realtime } from '@c8y/ngx-components/api';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DeviceControlService } from './device-control.service';
import { Router } from '@angular/router';
export interface DeviceData {
    id?: string;
    name?: string;
    externalId?: string;
    externalType?: string;
    lastUpdated?: Date;
    firmwareStatus?: string;
    availability?: string;
    alertDetails?: any;
    other?: any;
    type?: any;
    firmwareName?: string;
    firmwareVersionIssues?: string;
    firmwareVersionIssuesName?: string;
    responseInterval?: string;
    connectionStatus?: string;
    communicationMode?: string;
    hardwareModel?: string;
    creationTime?: string;
    owner?: string;
    childDeviceAvailable?: any;
    notes?: any;
    realtimeState: true;

}
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
   // displayedColumnsForList: string[] = ['id', 'name', 'owner', 'lastUpdated', 'creationTime', 'c8y_Availability.status', 'c8y_Notes', 'c8y_ActiveAlarmsStatus'];
    displayedColumnsForList: string[] = [];
    then: any;
    dataSource = new MatTableDataSource<any>([]);
    realtimeState: any;
    allSubscriptions: any = [];
    filterAssets: any;
    deviceListService: any;
    filterData: any;
    deviceListData: any;
    @ViewChild(MatSort, { static: false })
    set sort(v: MatSort) { this.dataSource.sort = v; }
    @ViewChild(MatTable, { static: false }) matTable: MatTable<any>;
    viewMode = '3';
    defaultImageId: any;
    dynamicDisplayColumns = [];
    appId!: string;
    appsimdata!: any;
    displayMode: any;
    appdata!: any;
    constructor(private appService: ApplicationService,
        private operations: OperationService,
        private inventoryService: InventoryService, private alertService: AlertService,
        private inventoryBinaryService: InventoryBinaryService,
        private deviceControlService: DeviceControlService,
        private realTimeService: Realtime, private sanitizer: DomSanitizer,
        private router:Router) {
    }
    async ngOnInit(): Promise<void> {
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        this.displayMode = this.widgetHelper.getWidgetConfig().displayMode ? this.widgetHelper.getWidgetConfig().displayMode : 'All';
        this.displayedColumnsForList = this.widgetHelper.getWidgetConfig().selectedInputs ? this.widgetHelper.getWidgetConfig().selectedInputs : ['id', 'name', 'owner', 'lastUpdated', 'creationTime', 'c8y_Availability.status', 'c8y_Notes', 'c8y_ActiveAlarmsStatus'];
        await this.updateDeviceStates(true); //all devices
        this.appId = this.getAppId();
        this.timerObs = interval(60000);
        if (this.widgetHelper.getWidgetConfig().defaultListView) {
            this.viewMode = this.widgetHelper.getWidgetConfig().defaultListView;
        } else {
            this.viewMode = '3';
            this.widgetHelper.getWidgetConfig().defaultListView = '3';
        }


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
        if (this.widgetHelper.getWidgetConfig().otherPropList && this.widgetHelper.getWidgetConfig().otherPropList.length > 0) {
             this.widgetHelper.getWidgetConfig().otherPropList.forEach((element) => {
                 if (element.label !== '' && element.value !== '') {
                     this.dynamicDisplayColumns.push(element);
                     this.displayedColumnsForList = this.displayedColumnsForList.concat([element.value]);
                    }
                })
            }       
        return;
    }

    getFirmwareRiskForFilter(version: any): any {
        throw new Error('Method not implemented.');
    }
    checkAvailabilty(inventory: any, availability: any): any {
        throw new Error('Method not implemented.');
    }
    getAlarmAndAvailabilty(x: any, promArr: any[]) {
        throw new Error('Method not implemented.');
    }
    checkAlarm(x: any, alertDesc: { minor: number; major: number; critical: number; warning: number; }): { minor: number; major: number; critical: number; warning: number; } {
        throw new Error('Method not implemented.');
    }
    async reload(): Promise<void> {
        this.appId = '';
        this.appsimdata = '';
        this.appdata = '';
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        await this.updateDeviceStates(true); //all devices
        this.timerObs = interval(60000);
        this.appId = this.getAppId();
       // console.log("appID", this.appId)
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
               // console.log("operation", operation);

                //get list of all simulators
                this.appdata = await this.deviceControlService.getAppSimulator(this.appId);
                if (this.appdata && this.appdata.applicationBuilder && this.appdata.applicationBuilder.simulators) {
                    //console.log("appdata", this.appdata);
                    this.appsimdata = this.appdata.applicationBuilder.simulators;
                   // console.log("appsimdata", this.appsimdata);

                }
                if (operation && operation.id === "Start") {
                    this.appsimdata.forEach((sim) => {
                        if (sim.config.deviceId === operation.deviceId) {
                            sim.started = true;
                            sim.config.matchingValue = 'default';
                            sim.config.alternateConfigs.operations.forEach((config) => {
                                if (config.matchingValue === 'default') {
                                    sim.config.value = config.value;
                                }
                            })
                        }
                    });
                    this.appdata.applicationBuilder.simulators = [...this.appsimdata];
                   // console.log("updated appdata", this.appdata);
                    await this.appService.update({
                        id: this.appdata.id,
                        applicationBuilder: this.appdata.applicationBuilder
                    } as any);
                }
                if (operation && operation.id === "Stop") {
                    this.appsimdata.forEach((sim) => {
                        if (sim.config.deviceId === operation.deviceId) {
                            sim.started = false;
                            sim.config.matchingValue = 'stop';
                            sim.config.alternateConfigs.operations.forEach((config) => {
                                if (config.matchingValue === 'stop') {
                                    sim.config.value = config.value;
                                }
                            })
                        }
                    });
                    this.appdata.applicationBuilder.simulators = [...this.appsimdata];
                   // console.log("updated appdata", this.appdata);
                    await this.appService.update({
                        id: this.appdata.id,
                        applicationBuilder: this.appdata.applicationBuilder
                    } as any);
                }
                if (operation && operation.id === "Reboot") {
                    this.appsimdata.forEach((sim) => {
                        if (sim.config.deviceId === operation.deviceId) {
                            sim.started = false;
                            sim.config.matchingValue = 'stop';
                            sim.config.alternateConfigs.operations.forEach((config) => {
                                if (config.matchingValue === 'stop') {
                                    sim.config.value = config.value;
                                }
                            })
                        }
                    });
                    this.appdata.applicationBuilder.simulators = [...this.appsimdata];
                    this.appsimdata.forEach((sim) => {
                        if (sim.config.deviceId === operation.deviceId) {
                            sim.started = true;
                            sim.config.matchingValue = 'default';
                            sim.config.alternateConfigs.operations.forEach((config) => {
                                if (config.matchingValue === 'default') {
                                    sim.config.value = config.value;
                                }
                            })
                        }
                    });
                    this.appdata.applicationBuilder.simulators = [...this.appsimdata];
                   // console.log("updated appdata", this.appdata);
                    await this.appService.update({
                        id: this.appdata.id,
                        applicationBuilder: this.appdata.applicationBuilder
                    } as any);
                }
                if (operation && operation.id === "Maintenance") {
                    this.appsimdata.forEach((sim) => {
                        if (sim.config.deviceId === operation.deviceId) {
                            sim.started = false;
                            sim.config.matchingValue = 'stop';
                            sim.config.alternateConfigs.operations.forEach((config) => {
                                if (config.matchingValue === 'stop') {
                                    sim.config.value = config.value;
                                }
                            })
                        }
                    });
                    this.appdata.applicationBuilder.simulators = [...this.appsimdata];
                  //  console.log("updated appdata", this.appdata);
                    await this.appService.update({
                        id: this.appdata.id,
                        applicationBuilder: this.appdata.applicationBuilder
                    } as any);
                }
                let { data, res } = await this.operations.create(operation);
                //console.log("operation res", res);

                if (res.status >= 200 && res.status < 300) {

                    if (data.status) {
                        if (data.status == OperationStatus.SUCCESSFUL) {
                            this.alertService.success(`operation ${op.name} for ${mo.name} is ${data.status}`);
                        } else if (data.status == OperationStatus.PENDING) {
                            /* let op: any = operation;
                             op.status =  "SUCCESSFUL";*/

                            this.alertService.success(`operation ${op.name} for ${mo.name} is ${data.status}`);
                            // this.operations.update(operation);
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
        this.clearSubscriptions();
    }

    async updateDevice(mo: any): Promise<void> {
        //console.log("moSubs", mo);
        return;
    }

    async updateDeviceStates(makeCall: boolean = false): Promise<void> {
        //here we just update the objects to refect their current state. 
        let ids: string[] = this.widgetHelper.getWidgetConfig().assets.map(mo => mo.id);

        if (makeCall) {
            console.log(this.displayMode,this.widgetHelper.getWidgetConfig().displayMode)
            this.widgetHelper.getWidgetConfig().assets = await this.widgetHelper.getDevices(this.inventoryService, ids,this.displayMode);

        }

        //console.log("UPDATE", this.widgetHelper.getWidgetConfig().assets, this.widgetHelper.getWidgetConfig().atRisk, this.widgetHelper.getWidgetConfig().deviceFilter);


        //filter at risk
        this.widgetHelper.getWidgetConfig().filteredAssets = this.widgetHelper.getWidgetConfig().assets.filter(mo => {
            this.defaultImageId = this.widgetHelper.getWidgetConfig().deviceIcon(mo.name);
            this.loadAssetImage(mo.image).then((image) => mo._boxImage = image);
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
        this.dataSource.data = this.widgetHelper.getWidgetConfig().filteredAssets;
        return;
    }

    public downloadBinary(id): any {
        return this.inventoryBinaryService.download(id);
    }

    async loadAssetImage(image): Promise<SafeResourceUrl> {

        if (!image && this.defaultImageId) {
            return this.sanitizer.bypassSecurityTrustResourceUrl(this.defaultImageId);
        }

        // if content of image variable is a number it is assumed it is a binary id
        // and therefore the corresponding image is loaded from the binary repository
        if (image && Number(image)) {
            const response = await this.downloadBinary(image) as Response;
            const binaryBlob = await response.blob();
            return this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(binaryBlob));
        }

        return this.sanitizer.bypassSecurityTrustResourceUrl('data:image/png;base64,' + image);
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
    toggle() {
        this.realtimeState = !this.realtimeState;
        if (this.realtimeState) {
            this.widgetHelper.getWidgetConfig().filteredAssets.forEach(x => {
                this.handleReatime(x.id);
            });
        } else {
            this.clearSubscriptions();
        }
    }

    handleReatime(id) {
        // REALTIME ------------------------------------------------------------------------
        const manaogedObjectChannel = `/managedobjects/${id}`;
        const detailSubs = this.realTimeService.subscribe(
            manaogedObjectChannel,
            (resp) => {
                const data = (resp.data ? resp.data.data : {});
                this.manageRealtime(data);
            }
        );
        if (this.realtimeState) {
            this.allSubscriptions.push({
                id: id,
                subs: detailSubs,
                type: 'Realtime',
            });
        } else {
            this.realTimeService.unsubscribe(detailSubs);
        }
    }

    manageRealtime(updatedDeviceData) {

        this.widgetHelper.getWidgetConfig().assets.push(updatedDeviceData);


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

            return mo.name.toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase());
        });

        this.widgetHelper.getWidgetConfig().filteredAssets = this.widgetHelper.getWidgetConfig().filteredAssets.sort((a, b) => a.name.localeCompare(b.name));
        this.dataSource.data = this.widgetHelper.getWidgetConfig().filteredAssets;
      //  console.log(this.dataSource.data);
    }
    private clearSubscriptions() {
        if (this.allSubscriptions) {
            this.allSubscriptions.forEach((s) => {
                this.realTimeService.unsubscribe(s.subs);
            });
        }
    }
    getAppId() {
        const currentURL = window.location.href;
        const routeParam = currentURL.split('#');
        if (routeParam.length > 1) {
            const appParamArray = routeParam[1].split('/');
            const appIndex = appParamArray.indexOf('application');
            if (appIndex !== -1) {
                return appParamArray[appIndex + 1];
            }
        }
        return '';
    }

    navigateUrlExists(assetName:string){
        const dashboardObj = this.config.dashboardList.find((dashboard) => dashboard.name === assetName || dashboard.name === 'All');
        if(dashboardObj && dashboardObj.templateID)
            return true;
        else
            return false;
    }

    navigateURL(deviceId: string, assetName: string) {
        if (assetName && this.appId) {
          const dashboardObj = this.config.dashboardList.find((dashboard) => dashboard.name === assetName || dashboard.name === 'All');
          if (dashboardObj && dashboardObj.templateID) {
            if (dashboardObj.withTabGroup) {
              this.router.navigate([
                `/application/${this.appId}/tabgroup/${deviceId}/dashboard/${dashboardObj.templateID}/device/${deviceId}`]);
            } else if (dashboardObj.tabGroupID) {
              this.router.navigate([
                `/application/${this.appId}/tabgroup/${dashboardObj.tabGroupID}/dashboard/${dashboardObj.templateID}/device/${deviceId}`]);
            } else {
              this.router.navigate([`/application/${this.appId}/dashboard/${dashboardObj.templateID}/device/${deviceId}`]);
            }
          }
        } else if (assetName) {
          this.router.navigate([`/device/${deviceId}`]);
        }
      }
}

