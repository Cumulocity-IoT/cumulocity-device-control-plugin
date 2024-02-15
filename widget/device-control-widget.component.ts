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
import { AlertService, Route } from '@c8y/ngx-components';
import { Realtime } from '@c8y/ngx-components/api';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DeviceControlService } from './device-control.service';
import { Router } from '@angular/router';
import { GpAssetViewerService } from './gp-asset-viewer.service';
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
}
@Component({
    selector: "lib-device-control-widget",
    templateUrl: "./device-control-widget.component.html",
    styleUrls: ["./device-control-widget.component.css"],
})
export class DeviceControlWidget implements OnDestroy, OnInit {

    widgetHelper: WidgetHelper<WidgetConfig>;
    @Input() config;
    //@ViewChild('assetfilter', { static: true }) filterInput: ElementRef;
    private timerObs: Observable<number>;
    private subs: Subscription[] = [];
    public input$ = new Subject<string | null>();
    public moSubs$ = new BehaviorSubject<any | null>(null);
    // displayedColumnsForList: string[] = ['id', 'name', 'owner', 'lastUpdated', 'creationTime', 'c8y_Availability.status', 'c8y_Notes', 'c8y_ActiveAlarmsStatus'];
    displayedColumnsForList: string[] = [];
    then: any;
    dataSource = new MatTableDataSource<any>([]);
    matData = [];
    realtimeState: any;
    allSubscriptions: any = [];
    filterAssets: any;
    filterData = [];
    deviceListData = [];
    configDashboardList: [];
    isBusy = false;

    @ViewChild(MatSort, { static: false })
    set sort(v: MatSort) { this.dataSource.sort = v; }
    @ViewChild(MatTable, { static: false }) matTable: MatTable<any>;
    viewMode = '3';
    defaultImageId: any;
    dynamicDisplayColumns = [];
    appId!: string;
    appsimdata!: any;
    //displayMode: any;
    appdata!: any;
    type?: any;
    latestFirmwareVersion = 0;

    currentPage = 1;
    pageSize = 5;
    totalRecord = -1;
    constructor(private appService: ApplicationService,
        private operations: OperationService,
        private inventoryService: InventoryService, private alertService: AlertService,
        private inventoryBinaryService: InventoryBinaryService,
        private deviceControlService: DeviceControlService,
        private router: Router,
        private realTimeService: Realtime, private sanitizer: DomSanitizer,
        private deviceListService: GpAssetViewerService,) {
    }
    async ngOnInit(): Promise<void> {
        this.isBusy = true;
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        this.pageSize = this.widgetHelper.getWidgetConfig()?.pageSize;
        //this.displayMode = this.widgetHelper.getWidgetConfig().displayMode ? this.widgetHelper.getWidgetConfig().displayMode : 'All';
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

        /*this.subs.push(fromEvent(this.filterInput.nativeElement, 'keyup')
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
        );*/
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
        this.configDashboardList = [];
        return;
    }

    async loadMatData(x: any) {
        let alertDesc = {
            minor: 0,
            major: 0,
            critical: 0,
            warning: 0
        };

        const promArr = new Array();
        let availability = x.c8y_Availability ? x.c8y_Availability.status : undefined;
        //let connectionStatus = x.c8y_Connection ? x.c8y_Connection.status : undefined;

        alertDesc = (x.hasOwnProperty('c8y_IsAsset')) ? await this.deviceListService.getAlarmsForAsset(x) : this.checkAlarm(x, alertDesc);
        this.getAlarmAndAvailabilty(x, promArr).then((res) => {
            const deviceData: DeviceData = {};
            res.forEach(data => {
                const inventory = data.data;
                // tslint:disable-next-line:no-unused-expression
                alertDesc ? alertDesc = this.checkAlarm(inventory, alertDesc) : '';
                // tslint:disable-next-line:no-unused-expression
                availability ? availability = this.checkAvailabilty(inventory, availability) : '';
            });

            deviceData.id = x.id;
            deviceData.name = x.name;
            deviceData.type = x.type;
            deviceData.lastUpdated = x.lastUpdated;
            deviceData.creationTime = x.creationTime;
            deviceData.owner = x.owner ? x.owner : 'Not available';
            if (x.childDeviceAvailable) {
                deviceData.childDeviceAvailable = x.childDeviceAvailable;
            }
            if (x.deviceExternalDetails) {
                deviceData.externalId = x.deviceExternalDetails.externalId ? x.deviceExternalDetails.externalId : 'Not available';
            } else {
                deviceData.externalId = 'Not available';
            }
            if (x.deviceExternalDetails) {
                deviceData.externalType = x.deviceExternalDetails.externalType ? x.deviceExternalDetails.externalType : 'Not available';
            } else {
                deviceData.externalType = 'Not available';
            }
            if (x.c8y_RequiredAvailability) {
                deviceData.responseInterval = x.c8y_RequiredAvailability.responseInterval ? x.c8y_RequiredAvailability.responseInterval : 'Not available';
            } else {
                deviceData.responseInterval = 'Not available';
            }
            if (x.c8y_Connection) {
                deviceData.connectionStatus = x.c8y_Connection.status ? x.c8y_Connection.status : 'Not available';
            } else {
                deviceData.connectionStatus = 'Not available';
            }
            if (x.c8y_CommunicationMode) {
                deviceData.communicationMode = x.c8y_CommunicationMode.mode ? x.c8y_CommunicationMode.mode : 'Not availble';
            } else {
                deviceData.communicationMode = 'Not available';
            }
            if (x.c8y_Hardware) {
                deviceData.hardwareModel = x.c8y_Hardware.model ? x.c8y_Hardware.model : 'Not available';
            } else {
                deviceData.hardwareModel = 'Not available';
            }
            if (x.c8y_Notes) {
                deviceData.notes = x.c8y_Notes;
            } else {
                deviceData.notes = 'Not available';
            }
            if (this.widgetHelper.getWidgetConfig().selectedInputs) {
                this.widgetHelper.getWidgetConfig().selectedInputs.forEach(element => {
                    if (x.c8y_Firmware && element === 'c8y_Firmware.version') {
                        deviceData.firmwareStatus = x.c8y_Firmware.version ? this.getFirmwareRiskForFilter(x.c8y_Firmware.version) : 'Not available';
                    } else {
                        deviceData.firmwareStatus = 'Not available';
                    }
                    if (x.c8y_Firmware && element === 'c8y_Firmware.name') {
                        deviceData.firmwareName = x.c8y_Firmware.name ? x.c8y_Firmware.name : 'Not available';
                    } else {
                        deviceData.firmwareName = 'Not available';
                    }
                    if (x.c8y_Firmware && element === 'c8y_Firmware.versionIssues') {
                        deviceData.firmwareVersionIssues = x.c8y_Firmware.versionIssues ? x.c8y_Firmware.versionIssues : 'Not available';
                    } else {
                        deviceData.firmwareVersionIssues = 'Not available';
                    }
                    if (x.c8y_Firmware && element === 'c8y_Firmware.versionIssuesName') {
                        deviceData.firmwareVersionIssuesName = x.c8y_Firmware.versionIssuesName ? x.c8y_Firmware.versionIssuesName : 'Not available';
                    } else {
                        deviceData.firmwareVersionIssuesName = 'Not available';
                    }
                    if (x.c8y_Availability && element === 'c8y_Availability.status') {
                        deviceData.availability = availability;
                    }
                    if (element === 'ActiveAlarmsStatus') {
                        deviceData.alertDetails = alertDesc;
                    }
                    if (element === 'c8y_ActiveAlarmsStatus') {
                        deviceData.alertDetails = alertDesc;
                    }
                });
            } else {
                if (x.c8y_Availability) {
                    deviceData.availability = availability;
                }
                if (alertDesc) {
                    deviceData.alertDetails = alertDesc;
                }
            }
            this.dynamicDisplayColumns.forEach(element => {
                deviceData[element.value] = this.getTheValue(x, element.value);
                deviceData[element.value] = JSON.stringify(this.getTheValue(x, element.value));
            });
            this.matData.push(deviceData);
            this.matTableLoadAndFilter();
        });
    }
    checkAlarm(inventory: IManagedObject, alertDesc: any): any {
        if (inventory.c8y_ActiveAlarmsStatus) {
            if (inventory.c8y_ActiveAlarmsStatus.hasOwnProperty('minor')) {
                if (inventory.c8y_ActiveAlarmsStatus.minor > 0) {
                    alertDesc.minor += inventory.c8y_ActiveAlarmsStatus.minor;
                }
            }
            if (inventory.c8y_ActiveAlarmsStatus.hasOwnProperty('major')) {
                if (inventory.c8y_ActiveAlarmsStatus.major > 0) {
                    alertDesc.major += inventory.c8y_ActiveAlarmsStatus.major;
                }
            }
            if (inventory.c8y_ActiveAlarmsStatus.hasOwnProperty('critical')) {
                if (inventory.c8y_ActiveAlarmsStatus.critical > 0) {
                    alertDesc.critical += inventory.c8y_ActiveAlarmsStatus.critical;
                }
            }
            if (inventory.c8y_ActiveAlarmsStatus.hasOwnProperty('warning')) {
                if (inventory.c8y_ActiveAlarmsStatus.warning > 0) {
                    alertDesc.warning += inventory.c8y_ActiveAlarmsStatus.warning;
                }
            }
        }
        return alertDesc;
    }

    matTableLoadAndFilter() {
        this.dataSource.data = this.matData;
        this.dataSource.sort = this.sort;
        this.dataSource.filterPredicate = ((x: any, filterValue: string) => this.matFilterConditions(x, filterValue));
    }

    // Filter conditioan for Material Table
    matFilterConditions(x: any, filterValue) {
        return !filterValue || x.id.includes(filterValue) ||
            x.name.toLowerCase().includes(filterValue.toLowerCase()) ||
            (x.externalId && x.externalId.toLowerCase().includes(filterValue.toLowerCase())) ||
            (x.availability && x.availability.toLowerCase().includes(filterValue.toLowerCase())) ||
            (x.firmwareStatus && x.firmwareStatus.toLowerCase().includes(filterValue.toLowerCase())) ||
            (x.alertDetails && this.isAlerts(x.alertDetails) && (
                this.isAlertCritical(x.alertDetails) && 'critical'.includes(filterValue.toLowerCase()) ||
                this.isAlertMajor(x.alertDetails) && 'major'.includes(filterValue.toLowerCase()) ||
                this.isAlertMinor(x.alertDetails) && 'minor'.includes(filterValue.toLowerCase()) ||
                this.isAlertWarning(x.alertDetails) && 'warning'.includes(filterValue.toLowerCase())
            )
            );
    }
    isAlertCritical(alarm) {
        return (alarm && alarm.critical && alarm.critical > 0);
    }
    isAlertMajor(alarm) {
        return (alarm && alarm.major && alarm.major > 0);
    }
    isAlertMinor(alarm) {
        return (alarm && alarm.minor && alarm.minor > 0);
    }
    isAlertWarning(alarm) {
        return (alarm && alarm.warning && alarm.warning > 0);
    }

    isAlerts(alarm) {
        if (alarm === undefined) { return false; }

        return (alarm.critical && alarm.critical > 0) || (alarm.major && alarm.major > 0)
            || (alarm.minor && alarm.minor > 0)
            || (alarm.warning && alarm.warning > 0);
    }

    isAlertsBGColor(alarm) {
        if (alarm) {
            if (alarm.critical && alarm.critical > 0) {
                return 'criticalAlerts';
            } else if (alarm.major && alarm.major > 0) {
                return 'majorAlerts';
            } else if (alarm.minor && alarm.minor > 0) {
                return 'minorAlerts';
            } else if (alarm.warning && alarm.warning > 0) {
                return 'warningAlerts';
            } else {
                return '';
            }
        }
        return '';
    }

    isAlertsColor(alarm) {
        if (alarm) {
            if (alarm.critical && alarm.critical > 0) {
                return 'criticalAlerts2';
            } else if (alarm.major && alarm.major > 0) {
                return 'majorAlerts2';
            } else if (alarm.minor && alarm.minor > 0) {
                return 'minorAlerts2';
            } else if (alarm.warning && alarm.warning > 0) {
                return 'warningAlerts2';
            } else {
                return '';
            }
        }
        return '';
    }

    loadText(alarm) {
        let alarmsStatus = '';
        if (alarm) {
            if (alarm.critical && alarm.critical > 0) {
                alarmsStatus = alarmsStatus + `Critical: ${alarm.critical} `;
            }
            if (alarm.major && alarm.major > 0) {
                alarmsStatus = alarmsStatus + `Major: ${alarm.major} `;
            }
            if (alarm.minor && alarm.minor > 0) {
                alarmsStatus = alarmsStatus + `Minor: ${alarm.minor} `;
            }
            if (alarm.warning && alarm.warning > 0) {
                alarmsStatus = alarmsStatus + `Warning: ${alarm.warning} `;
            }
        }
        return alarmsStatus;
    }

    getTotalAlerts(alarm) {
        let alertCount = 0;
        if (alarm) {
            if (alarm.critical && alarm.critical > 0) {
                alertCount += alarm.critical;
            }
            if (alarm.major && alarm.major > 0) {
                alertCount += alarm.major;
            }
            if (alarm.minor && alarm.minor > 0) {
                alertCount += alarm.minor;
            }
            if (alarm.warning && alarm.warning > 0) {
                alertCount += alarm.warning;
            }
        }
        return alertCount;
    }

    getTheValue(device, value: string) {
        if (typeof value === 'string' && value.includes('.')) {
            const arr = value.split('.');
            let actualValue = device[arr[0]] ? device[arr[0]] : undefined;
            if (actualValue !== undefined) {
                for (let i = 1; i < arr.length; i++) {
                    actualValue = actualValue[arr[i]];
                }
            }
            return actualValue;
        }
        return device[value];
    }

    getAlarmAndAvailabilty(device?: any, promArr?: any[]): any {

        if (device.childDevices && device.childDevices.references && device.childDevices.references.length > 0) {
            device.childDevices.references.forEach(async dev => {
                promArr.push(this.inventoryService.detail(dev.managedObject.id));
            });
        }
        return Promise.all(promArr);
    }

    checkAvailabilty(inventory, availability): any {
        if (inventory.c8y_Availability && inventory.c8y_Availability.status) {
            inventory.c8y_Availability.status === 'UNAVAILABLE'
                // tslint:disable-next-line:no-unused-expression
                ? availability = 'UNAVAILABLE' : '';
        }
        return availability;
    }

    getFirmwareRiskForFilter(version) {
        const versionIssue = this.calculateFirmwareRisk(version);
        if (versionIssue === -1) {
            return 'Low  Risk';
        } else if (versionIssue === -2) {
            return 'Medium Risk';
        } else if (versionIssue === -3) {
            return 'High Risk';
        } else {
            return 'No Risk';
        }
    }

    calculateFirmwareRisk(version) {
        let versionIssues = 0;
        versionIssues = version - this.latestFirmwareVersion;
        return versionIssues;
    }

    async reload(): Promise<void> {
        this.appId = '';
        this.appsimdata = '';
        this.appdata = '';
        this.matData = [];
        this.filterData = [];
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        await this.updateDeviceStates(true); //all devices
        this.timerObs = interval(60000);
        this.appId = this.getAppId();
        this.deviceListData = [];
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
        this.isBusy = true;
        //here we just update the objects to refect their current state. 
        if (makeCall) {
            const response: any = await this.widgetHelper.getDevices(this.inventoryService, this.pageSize, this.currentPage, this.widgetHelper.getWidgetConfig().includeChild);
            let retrieved = [];
            if (response.data && response.data.length > 0) {
                response.data.forEach((data) => {
                    retrieved.push(data);
                })
            }
            if (response.paging.length == 1) {
                if (response.data && response.data.length < this.pageSize) {
                    this.totalRecord = (this.pageSize * (response.paging[0].totalPages - 1)) + response.data.length;
                } else {
                    this.totalRecord = this.pageSize * response.paging[0].totalPages;
                } 
            }
            this.widgetHelper.getWidgetConfig().assets = retrieved;
            
        }

        //filter at risk
        this.widgetHelper.getWidgetConfig().filteredAssets = this.widgetHelper.getWidgetConfig().assets.filter(mo => {
            this.defaultImageId = this.widgetHelper.getWidgetConfig().deviceIcon(mo.name);
            this.loadAssetImage(mo.image).then((image) => mo._boxImage = image);
            if (!this.widgetHelper.getWidgetConfig().atRisk) {
                return true; //allow all
            }
            return this.deviceAtRisk(mo);
        });
        

        // console.log(this.widgetHelper.getWidgetConfig().assets);
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
        if (this.widgetHelper.getWidgetConfig().filteredAssets && this.widgetHelper.getWidgetConfig().filteredAssets.length > 0) {
            await this.asyncForEach(this.widgetHelper.getWidgetConfig().filteredAssets, async (x) => {
                this.filterData.push(x);
                this.deviceListData.push(x);
                this.loadMatData(x);
                if (this.realtimeState) {
                    this.handleReatime(x.id);
                }
            });
            this.isBusy = false;
            if (this.widgetHelper.getWidgetConfig().atRisk) {
                this.filterProblems();
            }
        } else {
            this.isBusy = false;
        }
        return;
    }

    // Polyfill for await in forEach
    async asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
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

        // For List View Check
        if (_.has(mo, "availability")) {
            let s = mo["availability"];
            r = true;
            if (s === "AVAILABLE") {
                r = false;
                if (_.has(mo, "sag_IsShutDown") && mo["sag_IsShutDown"] == true) {
                    r = true;
                }
            }
        }

        //other elements to check - connected?
        if (_.has(mo, "connectionStatus")) {
            let s = mo["availability"];
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
        console.log("updatedDeviceData from manageRealTime:",updatedDeviceData);
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
        const updatedRecord = this.filterData.find(singleDevice => singleDevice.id === updatedDeviceData.id);
        const updatedIndex = this.filterData.indexOf(updatedRecord);
        this.filterData[updatedIndex] = updatedDeviceData;
        this.matData = [...this.matData.filter(device => device.id !== updatedDeviceData.id)];
        this.loadMatData(updatedDeviceData);
        this.dataSource.sort = this.sort;
        this.applyFilter();
    }
    applyFilter() {
        if (this.widgetHelper.getWidgetConfig().deviceFilter) {
            this.filterData = this.filterData.filter(x => {
                return x.id.includes(this.widgetHelper.getWidgetConfig().deviceFilter) ||
                    x.name.toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase()) ||
                    (x.deviceExternalDetails && x.deviceExternalDetails.externalId.toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase())) ||
                    (x.availability && x.availability.toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase())) ||
                    (x.c8y_Firmware && x.c8y_Firmware.version &&
                        this.getFirmwareRiskForFilter(x.c8y_Firmware.version).toLowerCase().includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase())) ||
                    (x.alertDetails && this.isAlerts(x.alertDetails) && (
                        this.isAlertCritical(x.alertDetails) && 'critical'.includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase()) ||
                        this.isAlertMajor(x.alertDetails) && 'major'.includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase()) ||
                        this.isAlertMinor(x.alertDetails) && 'minor'.includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase()) ||
                        this.isAlertWarning(x.alertDetails) && 'warning'.includes(this.widgetHelper.getWidgetConfig().deviceFilter.toLowerCase())
                    ));
            });
        } else {
            this.filterData = this.deviceListData;
        }
        this.dataSource.filter = this.widgetHelper.getWidgetConfig().deviceFilter;
        if (this.widgetHelper.getWidgetConfig().atRisk) {
            this.filterProblems();
        }
    }

    // Filter between all records or only for "Attention required"
    filterProblems() {
        if (this.widgetHelper.getWidgetConfig().atRisk) {
            this.filterData = this.filterData.filter(x => {
                return this.deviceAtRisk(x);
            });
            this.widgetHelper.getWidgetConfig().deviceFilter = this.widgetHelper.getWidgetConfig().deviceFilter;
            let listFilterData: any[] = this.matData.filter(x => {
                return this.deviceAtRisk(x)
            });
            this.dataSource.data = listFilterData;
            if (this.matTable) { this.matTable.renderRows(); }
        } else {
            this.dataSource.data = this.matData;
            if (this.matTable) { this.matTable.renderRows(); }
            this.applyFilter();
        }


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

    /**
  * This method will called during page navigation
  */
    getPageEvent(pageEvent) {
        this.currentPage = pageEvent.page;
        this.clearSubscriptions();
        this.matData = [];
        this.deviceListData = [];
        this.filterData = [];
        this.dataSource.data = this.matData;
        this.updateDeviceStates(true);
    }

    navigateUrlExists(deviceType:string){
        if(this.appId && this.config.dashboardList){
            const dashboardObj = this.config.dashboardList.find((dashboard) => dashboard.type === 'All' || dashboard.type === deviceType);
            if(dashboardObj && dashboardObj.templateID)
                return true;
        }
        return false;
    }

    navigateURL(deviceId: string, deviceType: string) {
        if (/*deviceType && */this.appId && this.config.dashboardList) {
          const dashboardObj = this.config.dashboardList.find((dashboard) =>dashboard.type === 'All' || dashboard.type === deviceType);
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
        } else if (deviceType) {
          this.router.navigate([`/device/${deviceId}`]);
        }
      }

}
