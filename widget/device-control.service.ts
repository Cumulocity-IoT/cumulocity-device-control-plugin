/**
 * Copyright (c) 2020 Software AG, Darmstadt, Germany and/or its licensors
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

import { Injectable } from '@angular/core';
import { FetchClient , AlarmService, IManagedObject, IAlarm, Severity} from '@c8y/client';
import { AlertService } from '@c8y/ngx-components';
@Injectable()
export class DeviceControlService{
  listUrl = '';
  // microservice navigation url list
  baseUrl = 'service';
  isMSExist = false;

  constructor(private client: FetchClient, private alertervice: AlertService,private alarmService: AlarmService) {
  }

  post(amberBoonLogicObj: any): any {
    if (!this.isMSExist) {
      return;
    }
    return this.client.fetch(`${this.baseUrl}/${this.listUrl}`, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(amberBoonLogicObj),
      method: 'POST',
    });
  }

  put(amberBoonLogicObj: any): any {
    if (!this.isMSExist) {
      return;
    }
    return this.client.fetch(`${this.baseUrl}/${this.listUrl}`, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(amberBoonLogicObj),
      method: 'PUT',
    });
  }

  remove(amberBoonLogicObj: any): any {
    if (!this.isMSExist) {
      return;
    }
    return this.client.fetch(`${this.baseUrl}/${this.listUrl}`, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(amberBoonLogicObj),
      method: 'DELETE',
    });
  }

  async getAppSimulator(appId:string): Promise<any> {
    const response = await this.client.fetch(`/application/applications/${appId}`);
    const data = await response.json();
    if (data) {
      return data;
    } else {
      this.alertervice.danger('Application not found');
    }
  }

  async getAlarmsForAsset(asset: IManagedObject): Promise<{
    minor: number,
    major: number,
    critical: number,
    warning: number
  }> {
    const filter = {
      dateFrom: '1970-01-01',
      dateTo: new Date().toISOString(),
      pageSize: 2000,
      severity: 'WARNING,MINOR,MAJOR,CRITICAL',
      source: asset.id,
      status: 'ACTIVE',
      withSourceAssets: true,
      withSourceDevices: true
    }

    const alarms = (await this.alarmService.list(filter)).data;
    const alarmCount = this.calculateAlarmCounts(alarms);

    return alarmCount;
  }

  private calculateAlarmCounts(alarms: IAlarm[]): {
    minor: number,
    major: number,
    critical: number,
    warning: number
  } {
    const alarmCount = {
      minor: 0,
      major: 0,
      critical: 0,
      warning: 0
    }

    alarms.forEach(alarm => {
      if (alarm.severity === Severity.CRITICAL) {
        alarmCount.critical += alarm.count
      } else if (alarm.severity === Severity.MAJOR) {
        alarmCount.major += alarm.count
      } else if (alarm.severity === Severity.MINOR) {
        alarmCount.minor += alarm.count
      } else if (alarm.severity === Severity.WARNING) {
        alarmCount.warning += alarm.count
      }
    });

    return alarmCount;
  }
}
