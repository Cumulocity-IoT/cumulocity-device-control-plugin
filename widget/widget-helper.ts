/**
 * WidgetHelper is a utility class that will provide useful function to
 * authors when creating new widgets for Cumulocity.
 *
 * The main hook is to create an instance of the class in your widget
 * and then use whatever functionality you need.
 *
 * Widgets have config in cumulocity which gets updated when you
 * invoke the config page for the widget. This class wraps that
 * and provides useful common functionally on top.
 *
 * @format
 */

import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { IManagedObject, InventoryService } from '@c8y/client';
import { WIDGET_HEADER_CLASSES } from "@c8y/ngx-components/context-dashboard";


/**
 * The C8Y process has a standard member "config". This member has
 * the data from the config screen in it along with standard data
 * that might be set. We create a member of the config option containing
 * our set of configuration data.
 *
 * typically each widget class that accesses the config data (to set or retrieve)
 * will have an instance of this class. It will be created in the constructor
 * to default the config and ngInit to make sure it is up to date.
 *
 * The CONFIGTYPE generic is the class of WidgetConfig (or extended type TBD)
 */
export class WidgetHelper<CONFIGTYPE> {
    /**
     * The following 2 members are for checking types
     * do not store data in these!!!!
     */
    private reference: CONFIGTYPE;

    /**
     *  member that holds the actual data
     */
    private config: CONFIGTYPE;
    private rawConfig: any;
    /**
     *
     * E.G. let h = new WidgetHelper(config, MyConfigType); // type argument inference
     *
     * @param c is the configuration member supplied by default
     * @param ConfigCreator The type of the Custom Widget Class
     */
    constructor(c: Object, ConfigCreator: new () => CONFIGTYPE) {
        this.reference = new ConfigCreator(); //template
        this.rawConfig = c;
        // only set if it doesn't exist
        if (!_.has(c, "customwidgetdata")) {
            this.config = new ConfigCreator();
            //console.log("Create new config", this.config);
        } else {
            // because this is stored and retrieved from mongo db
            // reset the prototype and leave the data
            //console.log("Exists", c);
            this.config = _.get(c, "customwidgetdata");
            if (Object.getPrototypeOf(this.config) !== Object.getPrototypeOf(this.reference)) {
                Object.setPrototypeOf(this.config, Object.getPrototypeOf(this.reference));
            }
        }
        //console.log("composite", this.config);
    }

    /**
     * Use this member when accessing the configuration data
     *
     * @returns a reference to the widgets configuration with class methods
     */
    getWidgetConfig(): CONFIGTYPE {
        return this.config;
    }

    getDeviceTarget(): string | undefined {
        if (_.has(this.rawConfig, "device")) {
            //console.log("DEVICE");
            return this.rawConfig["device"].id;
        } else if (_.has(this.rawConfig, "settings")) {
            //console.log("SETTINGS");
            if (_.has(this.rawConfig["settings"], "context")) {
                //console.log("CONTEXT");
                return this.rawConfig["settings"]["context"].id;
            }
        }
        return undefined;
    }

    /**
     * Set the customwidgetdata member with the current config
     * typically call this when updating the config in a form
     *
     * @param c config member from the custom widget
     */
    setWidgetConfig(c: any) {
        _.set(c, "customwidgetdata", this.config);
    }

    getUniqueID(): string {
        if (!_.has(this.config, "uuid")) {
            _.set(this.config, "uuid", uuidv4());
        }
        //console.log(this.config);
        return _.get(this.config, "uuid");
    }


    async getDevicesAndGroups(inventoryService: InventoryService): Promise<IManagedObject[]> {

        let mos: IManagedObject[] = await this.getDeviceGroups(inventoryService);

        const filter: object = {
            pageSize: 2000,
            withTotalPages: true,
            query: "has(c8y_SupportedOperations) or has(c8y_IsDevice) or has(c8y_IsDeviceGroup)",
        };

        const query = {
            name: "*",
        };

        //const { data, res, paging } = await
        const { data, res, paging } = await inventoryService.listQueryDevices(query, filter);
        if (res.status === 200) {
            mos.push(...data);
        }
        //console.log("DEVICES AND GROUPS", mos);
        return mos;
    }

    async getDeviceGroups(inventoryService: InventoryService): Promise<IManagedObject[]> {
        //console.log("GetGroups");

        let mos: IManagedObject[] = [];

        const filter: object = {
            pageSize: 2000,
            withTotalPages: true,
            query: "has(c8y_IsDeviceGroup)",
        };

        const query = {
            name: "*",
        };

        const { data, res } = await inventoryService.listQueryDevices(query, filter);
        if (res.status === 200) {
            for (let g = 0; g < data.length; g++) {
                const group = data[g];
                if (!_.isEmpty(group.childAssets.references)) {
                    mos.push(group); //has children...
                }
            }
        }
        return mos;
    }

    async getDevices(inventoryService: InventoryService, ids: string[], pageSize: any, currentPage: any) {
        /*let queryString = '';
        if (deviceType === 'Assets') {
            queryString = 'has(c8y_IsAsset)'
        } else if (deviceType === 'Devices') {
            queryString = 'has(c8y_IsDevice)'
        }*/
        let response: any = {
            data: [],
            paging: []
        };
        const filter: object = {
            pageSize,
            withTotalPages: true,
            currentPage
            //query: (queryString ? queryString : ''),
        };

        if (this.config['selectedDevices'].length > 1) {
            let resp: any;
            for (let i = 0; i < this.config['selectedDevices'].length; i++) {
                let { data } = await inventoryService.detail(this.config['selectedDevices'][i].id);
                response.data = response.data.concat(Object.assign(data));
                resp = (await inventoryService.childAssetsList(this.config['selectedDevices'][i].id, filter));
                response.data = response.data.concat(Object.assign(resp.data));
                response.paging = response.paging.concat(Object.assign(resp.paging));
                //console.log(response.data);
            }
        } else {
            let { data } = await inventoryService.detail(this.config['selectedDevices'][0].id);
            response.data = response.data.concat(Object.assign(data));
            let resp: any = (await inventoryService.childAssetsList(this.config['selectedDevices'][0].id, filter));
            response.data = response.data.concat(Object.assign(resp.data));
            response.paging = response.paging.concat(Object.assign(resp.paging));
        }
        /*let retrieved: IManagedObject[] = [];
        if (response.data && response.data.length > 0) {
            response.data.forEach((data) => {
                retrieved.push(data);
            })
        }*/

        return response;
    }

    async getDevicesForGroup(inventoryService: InventoryService, mo: IManagedObject): Promise<IManagedObject[]> {

        let mos: IManagedObject[] = [];
        for (let g = 0; g < mo.childAssets.references.length; g++) {
            const device = mo.childAssets.references[g];
            const entry = device.managedObject.id;
            let { data, res } = await inventoryService.detail(entry);
            if (res.status === 200) {
                mos.push(data);
            }
        }
        return mos;
    }



}
