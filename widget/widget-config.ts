/** @format */

//
// Helper classes and interfaces
//
import { IManagedObject } from '@c8y/client';
import { Observable, of } from 'rxjs';
import * as _ from "lodash";
import { IconEntry } from './delite-list';


//there will be a finite set of operations which can be represented 
//by "buttons" on the front screen 
export interface DeviceOperation {
    payload: any;
    name: string;
    operation: string;
    icon: IconEntry;
    description: string;
    toggle: boolean;
    source: string;
    unsupported: boolean;
}

/**
 * This class will contain all the bespoke config for the widget
 */
export class WidgetConfig {
    /**
     * Members for the config
     * widgetConfiguration.myValue
     */
    group: Map<string, string>;
    selectedDevices: IManagedObject[]; //can include groups
    assets: IManagedObject[]; //should be just devices
    filteredAssets: IManagedObject[]; //should be just devices
    selectedOperations: DeviceOperation[];
    selectedToggles: DeviceOperation[];
    deviceSettings: Map<string, string>;
    deviceImageHeight: number;
    deviceImageWidth: number;
    deviceColumns: number;
    showAvailability: boolean;
    showAlarms: boolean;
    showOperations: boolean;
    atRisk: boolean = false;
    showFilters: boolean = false;
    overrideDashboardDevice: boolean = false;
    deviceFilter: string = '';
    defaultListView: string = '';
    //displayMode: string = '';
    selectedInputs: any;
    otherPropList: {
        //
        // Helper classes and interfaces
        //
        label // Helper classes and interfaces
        : string; value: string;
    }[];
    /**
     *  Create an instance of the config object
     */
    constructor() {
        this.group = new Map();
        this.selectedDevices = [];
        this.assets = [];
        this.filteredAssets = [];
        this.selectedOperations = [];
        this.selectedToggles = [];
        this.deviceSettings = new Map();
        this.deviceImageHeight = 125;
        this.deviceImageWidth = 125;
        this.deviceColumns = 3;
        this.showAvailability = true;
        this.showAlarms = true;
        this.showOperations = true;
        this.deviceSettings['default-device'] = require("@widget-assets/iot-sensor-icon.jpg");
        this.deviceSettings['default-operation'] = {
            key: "fa-power-off", name: "Power Off", code: "f011", filter: ["on"]
        };
        this.deviceSettings['heartbeat'] = {
            "key": "fa-heartbeat",
            "name": "Heartbeat",
            "code": "f21e",
            "filter": [
                "ekg"
            ]
        };
    }

    //add managed object to group list
    addToGroup(group: string, mo: IManagedObject): void {
        if (!this.group) {
            this.group = new Map();
        }
        this.group[mo.id] = group;
    }

    //get the dashboard url for a device
    dashboardUrl(mo: IManagedObject): string | undefined {
        let url = undefined;
        if (_.has(this.group, mo.id)) {
            if (this.deviceSettings['group' + this.group[mo.id]] !== "") {
                url = _.has(this.deviceSettings, 'group' + this.group[mo.id]) ? this.deviceSettings['group' + this.group[mo.id]] : undefined;
                if (url) {
                    url += `/device/${mo.id}`;
                }
            }
        }
        return url;
    }

    validOperation(mo: IManagedObject, op: DeviceOperation): boolean {
        if (_.has(mo, "c8y_SupportedOperations")) {
            if (mo.c8y_SupportedOperations.includes(op.operation)) {
                return true;
            }
        }

        return (op.toggle || op.unsupported);
    }


    imageWidth(): string {
        return this.deviceImageWidth + "px";
    }
    imageHeight(): string {
        return this.deviceImageHeight + "px";
    }

    setCols(x: number): void {
        this.deviceColumns = x;
    };

    setImageSize(x: number): void {
        this.deviceImageWidth = x;
        this.deviceImageHeight = x;
    };

    deviceStatus(mo: IManagedObject): string {
        if (_.has(mo, "c8y_Availability")) {
            if (mo["c8y_Availability"].status === "UNAVAILABLE") {
                return "badge-danger";
            } else if (mo["c8y_Availability"].status === "AVAILABLE" && _.has(mo, "sag_IsShutDown")) {
                if (mo["sag_IsShutDown"] == true) {
                    return "badge-warning";
                } else {
                    return "badge-success";
                }
            } else if (mo["c8y_Availability"].status === "AVAILABLE") {
                return "badge-success";
            } else if (mo["c8y_Availability"].status === "MAINTENANCE") {
                return "badge-warning";
            }
            return "badge-primary";
        }
        return "badge-success";
    }

    alarmStatus(mo: IManagedObject): string {
        let ac = this.getAlarmCount(mo);
        if (ac > 0) {
            return "badge-danger";
        }
        return "badge-success";
    }

    deviceStatusLabel(mo: IManagedObject): string {
        if (_.has(mo, "c8y_Availability")) {
            if (mo["c8y_Availability"].status === "AVAILABLE" && _.has(mo, "sag_IsShutDown")) {
                if (mo["sag_IsShutDown"] == true) {
                    return "AVAILABLE (STANDBY)";
                }
            }
            return mo["c8y_Availability"].status;
        }
        return "AVAILABLE";
    }

    operationIcon(op: string | DeviceOperation): string {
        if (typeof op === "string") {
            if (!_.has(this.deviceSettings, op)) {
                this.deviceSettings[op] = this.deviceSettings['default-operation'];
            }
            else
                return this.deviceSettings[op].key;
        } else {
            return op.icon.key;
        }
    }

    deviceIcon(dev: string): string {
        if (_.has(this.deviceSettings, dev)) {
            return this.deviceSettings[dev];
        }
        return this.deviceSettings['default-device'];
    }

    selectedDevices$(): Observable<IManagedObject[]> {
        return of(this.selectedDevices);
    };

    selectedOperations$(): Observable<DeviceOperation[]> {
        return of(this.selectedOperations);
    };

    getAlarmCount(device) {
        let countAlarms = 0;

        if (_.has(device, 'c8y_ActiveAlarmsStatus') || _.has(device, 'alertDetails')) {

            const alarmStatus = _.get(device, 'c8y_ActiveAlarmsStatus') || _.get(device, 'alertDetails');
            _.forEach(_.values(alarmStatus), alarmCount => {
                countAlarms += alarmCount;
            });
        }
        return countAlarms;
    }

    getOperationsList(): DeviceOperation[] {
        let operations: DeviceOperation[] = [];
        if (this.selectedToggles) {
            operations.push(...this.selectedToggles);
        }
        if (this.selectedOperations) {
            operations.push(...this.selectedOperations);
        }
        return operations;
    }
}
