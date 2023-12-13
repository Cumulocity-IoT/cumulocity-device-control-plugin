/*
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
 */
import { Component, Input, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { WidgetHelper } from "./widget-helper";
import { MatTableDataSource } from '@angular/material/table';
import { WidgetConfig, DeviceOperation } from "./widget-config";
import { OperationService, IManagedObject, InventoryService } from '@c8y/client';
import * as _ from "lodash";
import { BehaviorSubject, from, Observable } from 'rxjs';
import { deliteList } from './delite-list';
import { AlertService } from '@c8y/ngx-components';
import { SELECTION_MODEL_FACTORY } from '@ng-select/ng-select';
import { FormBuilder } from '@angular/forms';
import { DefaultSelectionModelFactory } from './selection-model';
//shared css with main widget
export interface Property {
    id: any;
    label: string;
    value: string;
}

export interface DashboardConfig {
    type?: any;
    templateID?: string;
    tabGroupID?: string;
    tabGroup?: boolean;
  }
@Component({
    selector: "device-control-widget-config-component",
    templateUrl: "./device-control-widget.config.component.html",
    styleUrls: ['./../node_modules/@ng-select/ng-select/themes/default.theme.css', './device-control-widget.component.css'],
    encapsulation: ViewEncapsulation.None,
    providers: [FormBuilder,
        { provide: SELECTION_MODEL_FACTORY, useValue: DefaultSelectionModelFactory }
    ],
})

export class DeviceControlWidgetConfig implements OnInit, OnDestroy {

    sublist = [];
    propertiesToDisplayList: Property[] = [];
    //members
    public rawDeviceSelection: Observable<IManagedObject[]>;
    public rawDevices: Observable<IManagedObject[]>;
    public rawOperations: BehaviorSubject<DeviceOperation[]>;
    public assets: BehaviorSubject<IManagedObject[]>;
    fpDataSource = new MatTableDataSource<Property>([]);
    p1DataSource = new MatTableDataSource<Property>([]);
    p2DataSource = new MatTableDataSource<Property>([]);
    exemptedValues: string[] = [
        'additionParents',
        'assetParents',
        'c8y_DataPoint',
        'childAdditions',
        'childAssets',
        'childDevices',
        'com_cumulocity_model_Agent',
        'deviceParents',
        'self'
    ];
    public CONST_HELP_IMAGE_FILE =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADdgAAA3YBfdWCzAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAATzSURBVGiB7VlrTBxVFP7usLu8kUeBLSAFipUqFg1Qq5EgaCU2/DAxpYqJCVExmNC0Km1jolmbxgSCKbWoITG+oq1Ba6M1mvQHqxJTEyS0aEBiSyvIY2F5dl32Mczxh1WZndmdubOoTeD7d88995zvzH2cM/cC61jH2gZbFSs2m2B1l5VIEMoYUArgFgBZAa5GARogRj0CE7ono77uhc0mhes6rAAyD9iz/MQamUCPgZDJOXwUhA9FUWqfOXrfmFEOhgLIPtSd5JXEwwCeAhBp1Pk1eMDQ4fXCNt9WMc87mDsA68GuGiLWDiCVd6wGHAR6Zqql8lOeQfoDqP/BnJ7oageonpsaB4jw+lQs9sFWIerR1xVAqs0eJyyxUyB6IDx6+kDAV0zy7Xa0Vv2upStoKeQ3fhkpuPHFf0UeABjwIATLmVttnRYtXc0AXFFRRwGUrwozPlQ4l1JbtJRCLqH0JvseMHy0epz4QaCHQ23soAFsOHA2I4JZBkGUoNcZY8CO3CRUF1lRdGM8Yi0mAIBPlHBx2o2uwWmc6XfAJ/LkLzYLybvV0Vo1pdZrCjYsAubDPOQTos048lAB7t6cpNqfEmfBnbmJqN2RiYOfDOLilOb+vAZKZoLlZQANar2qM2A9ZM8hCb8gRIArYRIYOh7fhqKsG3RRcrp8qOnoxeKSX5c+AH8EE/PHm3eOBHaobmJaxtPQSR4AqovSFeRFidBzZR7nhufg9i/L+jbEWVC7navyMC+TSTX/KAOw2U1gqOOxvqswTdb2ixLq37+Ahg/60XjiR9S8qfza5VuSeVwAYHXY3RkRKFUEkLYkbQeQzmM6LzVW1u4amkH/b4t/tycXPbAPzch0spKjeVwAoAxrbkpxoFQRACOhgtMyEmPMsvbo7JJCx+WVVwbE6wQAoOSmts5LeM2WHPlWU6d4k3yPXJ7WewqtAENpoEhtE9/Ebzk0HinNRIE1Xib7/LyD2w4RtgTKVAJgG7kth0B1UTr278yTyfpGFnC6b8KIOQU3tSUUZ8SyGmpKMtBUlQ+2Ittcdrrx3McDkIxtgvhAgcoM0Kr8J2/LSsDzVZtl5H+dcWPvyZ94Epgm1JbQ1dUw3HBvDoQV7CcWPHjyvQuYWPCEY1bBTW0GDC3OlYiLNOGObPmp8+JnQ5hzh/3lFdyUeYDh53C9bEqJgUn45+uPz3twfmQhXLOACjdFAEToC9dPQpQ841+adodrEgDACL2BMsUpREyyM9L8UQuJc8NzupIbPyR7oETBdCq6+3uAKcrW/x9seLKlsidQqlKN2iQQnQjHlUlgaCjPwbt1t+N47W3YulFxfBsAnQSYInuo/w+Yl9sAKCsyndhTmoknyrJRmJmAu/KS8NqjhYgxKyphHrgiltGm1qEawNQr9zuI8LZRb8U5ibJ2UowZeWmxQbR14a3xVyucah1Bd6voWXoBKueuHozNySdPlMh4AmMYW4b5pWDdQQOYPb5rEYT9Rny+890oBib+TJp+UULr2UuYcfmMmAIR7XW23BO0OtCse6xNXW8QY6o3AlrYEGfBVa8Ir9/gMwDDMUdzxb5QKpoH/uQVZyMYThvx73T5DJNnDKcc0d88q6mnx9j1fLm7Nq7XV+J6e+DgLnommys7IwXTzQDaAXh5x6vAA4ZjXh8KeMkDa/WRT4Hgz6x/3fTO/VvPrOtYx1rHHxm4yOkGvwZ0AAAAAElFTkSuQmCC";

    widgetHelper: WidgetHelper<WidgetConfig>;
    icons: ({ key: string; name: string; code: string; filter: string[]; } | { key: string; name: string; code: string; filter?: undefined; })[];
    otherPropList: boolean;

    dashboardList: DashboardConfig[] = [];
    appId=null;
    isExpandedDBS=false;
    deviceTypes:string[]=[];

    constructor(public operations: OperationService, public inventoryService: InventoryService, public alertService: AlertService, private invSvc: InventoryService,) {
        //make availiable for choosing
        this.icons = [...deliteList.icons];
        this.rawOperations = new BehaviorSubject<DeviceOperation[]>([]);
        this.assets = new BehaviorSubject<IManagedObject[]>([]);
    }

    getIconString(code) {
        let startCode = parseInt(`0x${code}`);
        return String.fromCharCode(startCode);
    }
    getDeviceProperties(id: any) {
        // tslint:disable-next-line:variable-name
        /*let queryString: any;
        if (this.widgetHelper.getWidgetConfig().displayMode === 'Devices') {
            queryString = 'has(c8y_IsDevice)'
        } else if (this.widgetHelper.getWidgetConfig().displayMode === 'Assets') {
            queryString = 'has(c8y_IsAsset)'
        }*/
        const _this = this;
        const filter: object = {
            pageSize: 100,
            withTotalPages: true,
          //  query: (queryString ? queryString : ''),
        };
        // console.log(filter, "")
        this.invSvc.childAssetsList(id, filter).then(res => {
            res.data.forEach(mo => {
                _this.getObjectsAllProperties(mo, _this.propertiesToDisplayList);
            });
        });
        this.invSvc.childAssetsList(id, filter).then(res => {
            res.data.forEach(mo => {
                _this.getObjectsAllProperties(mo, _this.propertiesToDisplayList);
            });
        });
    }
    
    getObjectsAllProperties(object: object, propertyTypes: Property[]): any {
        // tslint:disable-next-line:variable-name
        const _this = this;
        return Object.keys(object).forEach(key => {
            if (_this.exemptedValues.indexOf(key) < 0) {
                if (propertyTypes.findIndex(prop => {
                    return prop.value === key;
                }) === -1) {
                    if ((object[key] !== null && typeof object[key] === 'object')) {
                        _this.fetchObjects(object[key], key, propertyTypes);
                    } else if (typeof object[key] === 'string') {
                        propertyTypes.push({ id: key, label: key, value: key });
                    } else if (typeof object[key] === 'number') {
                        propertyTypes.push({ id: key, label: key, value: key });
                    }
                }
            }
        });
    }
    fetchObjects(arg0: any, key: string, propertyTypes: Property[]) {
        throw new Error('Method not implemented.');
    }
    async ngOnInit(): Promise<void> {
        this.appId=this.getAppId();
        this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default access through here
        if(!this.config.dashboardList && this.widgetHelper.getWidgetConfig().selectedDevices && this.widgetHelper.getWidgetConfig().selectedDevices.length>0 && this.appId){
            this.dashboardList=[];
            let deviceTypesAdded:string[]=[];
            this.widgetHelper.getWidgetConfig().selectedDevices.forEach((device)=>{
                if(this.widgetHelper.getWidgetConfig().deviceSettings.hasOwnProperty('group' + device.name)){
                    const url=this.widgetHelper.getWidgetConfig().deviceSettings['group' + device.name];
                    const dashboardId=url.split("dashboard")[1].split("/")[1];                  
                    this.widgetHelper.getWidgetConfig().assets.forEach((asset)=> {
                        if(asset.type && !asset.hasOwnProperty("c8y_IsDeviceGroup") && !deviceTypesAdded.includes(asset.type)){
                            const dashboardObj: DashboardConfig = {};
                            dashboardObj.type = asset.type;
                            dashboardObj.templateID=dashboardId;
                            this.dashboardList.push(dashboardObj);
                            deviceTypesAdded.push(asset.type);
                        }
                    });
                }
            });
            const dashboardObj: DashboardConfig = {};
            dashboardObj.type = 'All';
            this.dashboardList.push(dashboardObj);
            this.config.dashboardList=this.dashboardList;
        }
        else if ((!this.config.dashboardList || this.config.dashboardList.length==0) && this.appId) {
            const dashboardObj: DashboardConfig = {};
            dashboardObj.type = 'All';
            this.dashboardList.push(dashboardObj);
            this.config.dashboardList = this.dashboardList;
        }
        this.rawDevices = from(this.widgetHelper.getDevicesAndGroups(this.inventoryService));
        this.widgetHelper.getWidgetConfig().deviceFilter = ""; //clear if you edit
        //console.log("OVERRIDE", this.widgetHelper.getWidgetConfig().overrideDashboardDevice, "DEVICE TARGET", this.widgetHelper.getDeviceTarget());
        if (!this.widgetHelper.getWidgetConfig().overrideDashboardDevice && this.widgetHelper.getDeviceTarget()) {
            //console.log("Device Target=", this.widgetHelper.getDeviceTarget());
            let { data, res } = await this.inventoryService.detail(this.widgetHelper.getDeviceTarget());
            //console.log(data, res);
            if (res.status >= 200 && res.status < 300) {
                this.widgetHelper.getWidgetConfig().selectedDevices = [data];
            } else {
                this.alertService.danger(`There was an issue getting device details, please refresh the page.`);
                return;
            }
        }//else use un altered list from the user set in config
        if (!this.widgetHelper.getWidgetConfig().defaultListView) {
            this.widgetHelper.getWidgetConfig().defaultListView = '3';
        }

       /* if (!this.widgetHelper.getWidgetConfig().displayMode) {
            this.widgetHelper.getWidgetConfig().displayMode = 'All';
        }*/

        this.propertiesToDisplayList = [
            { id: 'id', label: 'ID', value: 'id' },
            { id: 'name', label: 'Name', value: 'name' },
            { id: 'owner', label: 'Owner', value: 'owner' },
            { id: 'childDeviceAvailable', label: 'Child devices', value: 'childDeviceAvailable' },
            { id: 'c8y_Availability.status', label: 'Availability status', value: 'c8y_Availability.status' },
            { id: 'c8y_Connection.status', label: 'Connection status', value: 'c8y_Connection.status' },
            { id: 'c8y_Firmware.name', label: 'Firmware name', value: 'c8y_Firmware.name' },
            { id: 'c8y_Firmware.version', label: 'Firmware version', value: 'c8y_Firmware.version' },
            { id: 'c8y_Firmware.versionIssues', label: 'Firmware verison issues', value: 'c8y_Firmware.versionIssues' },
            { id: 'c8y_Firmware.versionIssuesName', label: 'Firmware issue name', value: 'c8y_Firmware.versionIssuesName' },
            { id: 'c8y_RequiredAvailability.responseInterval', label: 'Required availability', value: 'c8y_RequiredAvailability.responseInterval' },
            { id: 'creationTime', label: 'Creation time', value: 'creationTime' },
            { id: 'lastUpdated', label: 'Last updated', value: 'lastUpdated' },
            { id: 'deviceExternalDetails.externalId', label: 'External id', value: 'deviceExternalDetails.externalId' },
            { id: 'deviceExternalDetails.externalType', label: 'External type', value: 'deviceExternalDetails.externalType' },
            { id: 'c8y_Notes', label: 'Notes', value: 'c8y_Notes' },
            { id: 'type', label: 'Type', value: 'type' },
            { id: 'c8y_CommunicationMode.mode', label: 'Communication Mode', value: 'c8y_CommunicationMode.mode' },
            { id: 'c8y_Hardware.model', label: 'Hardware Model', value: 'c8y_Hardware.model' },
            { id: 'c8y_ActiveAlarmsStatus', label: 'Active alarms status', value: 'c8y_ActiveAlarmsStatus' },
            { id: 'other', label: 'Other', value: 'other' }
        ];

        if (!this.widgetHelper.getWidgetConfig().selectedInputs) {
            this.widgetHelper.getWidgetConfig().selectedInputs = ['id', 'name', 'deviceExternalDetails.externalId', 'lastUpdated', 'c8y_Availability.status', 'c8y_ActiveAlarmsStatus'];
        }
        if (this.widgetHelper.getWidgetConfig().selectedInputs && this.widgetHelper.getWidgetConfig().selectedInputs.indexOf('other') !== -1) {
            this.otherPropList = true;
        }
        //set the selected in the case of a deviceTarget
        this.onConfigChanged();
    };

    handleImage(e) {
        const selectedImage = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            this.widgetHelper.getWidgetConfig().deviceSettings['default-device'] = reader.result.toString();
            this.onConfigChanged();
        };
        reader.onerror = error => console.log(error);
        reader.readAsDataURL(selectedImage);
    }

    ngOnDestroy(): void {
        //unsubscribe from observables here
        this.sublist.forEach(o => o.unsubscribe());
    };


    @Input() config: any = {};


    async populateOperations(): Promise<void> {
        let r: string[] = [];

        this.widgetHelper.getWidgetConfig().assets = [];
        //console.log("Selected", this.widgetHelper.getWidgetConfig().selectedDevices);
        for (let index = 0; index < this.widgetHelper.getWidgetConfig().selectedDevices.length; index++) {

            const m = this.widgetHelper.getWidgetConfig().selectedDevices[index];

            //if m is a group we should expand it
            if (_.has(m, "c8y_IsDeviceGroup")) {
                this.widgetHelper.getWidgetConfig().assets.push(m);//as well as add it.
                let children = await this.widgetHelper.getDevicesForGroup(this.inventoryService, m);
                for (const child of children) {
                    this.widgetHelper.getWidgetConfig().addToGroup(m.name, child);
                    this.widgetHelper.getWidgetConfig().assets.push(child);
                    //console.log("adding", child.name );
                    if (_.has(child, "c8y_SupportedOperations")) {
                        r.push(...child.c8y_SupportedOperations);
                    }
                }
            } else if (_.has(m, "c8y_SupportedOperations")) {
                this.widgetHelper.getWidgetConfig().assets.push(m);
                r.push(...m.c8y_SupportedOperations);
            } else {
                this.widgetHelper.getWidgetConfig().assets.push(m);
            }
            r.push("User Defined"); //allow user to create own operation 
        }
        //unique 
        r = [...new Set(r)];
        this.widgetHelper.getWidgetConfig().assets = [...new Set(this.widgetHelper.getWidgetConfig().assets)];
        // console.log("assets", this.widgetHelper.getWidgetConfig().assets);
        this.deviceTypes=[];
        this.widgetHelper.getWidgetConfig().assets.forEach((asset)=> {
            if(asset.type && !asset.hasOwnProperty("c8y_IsDeviceGroup") && !this.deviceTypes.includes(asset.type))
                this.deviceTypes.push(asset.type);
        });
        //map to objects
        let ops = r.map(o => {
            return <DeviceOperation>{
                operation: o,
                name: o,
                icon: deliteList.icons[0],
                payload: '{"text":"value"}',
                toggle: false,
                source: "key",
                description: "",
                unsupported: (o === "User Defined" ? true : false)
            };
        });

        //console.log("ops", ops);
        this.rawOperations.next(ops);
        this.assets.next([...this.widgetHelper.getWidgetConfig().assets.sort((a, b) => a.name.localeCompare(b.name))]);
    }

    onConfigChanged(): void {
        //console.log("CONFIG-CHANGED"); 
        this.populateOperations();
        this.widgetHelper.setWidgetConfig(this.config); //propgate changes 
        //console.log(this.widgetHelper.getWidgetConfig());
    }

    addToggle() {
        this.widgetHelper.getWidgetConfig().selectedToggles.push(
            <DeviceOperation>{
                operation: "toggle",
                name: "toggle",
                icon: deliteList.icons[0],
                payload: "NA",
                toggle: true,
                source: "managed object key",
                description: "toggle key true/false on the managed object"
            }
        );
    }

    addCommand(op: DeviceOperation) {
        let copy = _.cloneDeep(op);
        this.widgetHelper.getWidgetConfig().selectedOperations.push(
            copy
        );
    }

    deleteCommand(index: number) {
        this.widgetHelper.getWidgetConfig().selectedOperations.splice(index, 1);
    }

    removeToggle(index: number) {
        this.widgetHelper.getWidgetConfig().selectedToggles.splice(index, 1);
    }

    onColChange() {
        this.widgetHelper.getWidgetConfig().selectedInputs.forEach((element) => {
            if (element.indexOf('other') !== -1) {
                this.otherPropList = true;
            } else {
                this.otherPropList = false;
                this.widgetHelper.getWidgetConfig().otherPropList = [{ label: '', value: '' }];
            }
        });
        if (this.widgetHelper.getWidgetConfig().selectedInputs.length === 0) {
            this.otherPropList = false;
            this.widgetHelper.getWidgetConfig().otherPropList = [{ label: '', value: '' }];
        }
    }


    removeProperty(i) {
        if (this.widgetHelper.getWidgetConfig().otherPropList.length > 1) {
            this.widgetHelper.getWidgetConfig().otherPropList.splice(i, 1);
        }
    }

    addProperty() {
        this.widgetHelper.getWidgetConfig().otherPropList.push({ label: '', value: '' });
    }


    // Tile List View
    displayList(value) {
        this.widgetHelper.getWidgetConfig().defaultListView = value;
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
   * Add new Row for Dashbaord Settings
   */
  addNewRecord(currentIndex) {
    if ((currentIndex + 1) === this.config.dashboardList.length) {
      const dashboardObj: DashboardConfig = {};
      dashboardObj.type = 'All';
      this.config.dashboardList.push(dashboardObj);
    }
  }
}

