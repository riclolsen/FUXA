import { Component, OnInit, OnDestroy, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { Subscription } from "rxjs";
import { MatDialog } from '@angular/material';

import { DevicePropertyComponent } from './../device-property/device-property.component';
import { ProjectService } from '../../_services/project.service';
import { PluginService } from '../../_services/plugin.service';
import { Device, DeviceType, DeviceNetProperty } from './../../_models/device';
import { Utils } from '../../_helpers/utils';
import { Plugin } from '../../_models/plugin';

@Component({
	selector: 'app-device-map',
	templateUrl: './device-map.component.html',
	styleUrls: ['./device-map.component.scss']
})
export class DeviceMapComponent implements OnInit, OnDestroy, AfterViewInit {

	@Output() goto: EventEmitter<Device> = new EventEmitter();
	private subscriptionPluginsChange: Subscription;

	server: Device;
	devices = {};
    plugins = [];

	devicesStatus = {};
	dirty: boolean = false;

	constructor(private dialog: MatDialog,
        private pluginService: PluginService,
		private projectService: ProjectService) { }

	ngOnInit() {
		this.loadCurrentProject();
		this.loadAvailableType();
		this.subscriptionPluginsChange = this.pluginService.onPluginsChanged.subscribe(event => {
			this.loadAvailableType();
		});
	}

	ngAfterViewInit() {
	}

	ngOnDestroy() {
		try {
			if (this.subscriptionPluginsChange) {
				this.subscriptionPluginsChange.unsubscribe();
			}
		} catch (e) {
		}
	}

	onEditDevice(device: Device) {
		this.editDevice(device, false);
	}

	loadCurrentProject() {
		// take the copy of devices to save by leave
		let prj = this.projectService.getProject();
		if (prj && prj.server) {
			this.server = prj.server;
		}
		if (prj && prj.devices) {
			this.devices = prj.devices;
		}
	}

	loadAvailableType() {
		// define available device type (plugins)
		this.plugins = [];
		this.pluginService.getPlugins().subscribe(plugins => {
			Object.values(plugins).forEach((pg) => {
				if (pg.current.length) {
					this.plugins.push(pg.type);
				}
			});
        }, error => {
        });
	}

	addDevice() {
		let device = new Device();
		device.id = Utils.getGUID();
		device.property = new DeviceNetProperty();
		device.enabled = false;
		device.tags = {};
		this.editDevice(device, false);
	}

	onRemoveDevice(device: Device) {
		this.editDevice(device, true);
	}

	removeDevice(device: Device) {
		delete this.devices[device.name];
	}

	getDevicePosition(index: number) {
		if (this.devices && Object.values(this.devices).length) {
			let offset = 160; // scss.$card-width
			let pos = index + 1;
			let centerd = Object.keys(this.devices).length + 1;
			let result = ((window.innerWidth - offset) / centerd) * pos;
			return result;
		}
		return 0;
	}

	getDeviceLinePosition(index: number) {
		if (this.devices && Object.values(this.devices).length) {
			let offset = 160; // scss.$card-width
			let pos = index + 1;
			let centerd = Object.keys(this.devices).length + 1;
			let result = ((window.innerWidth - offset) / centerd) * pos;
			result += (160 - 6) / 2; // card center: scss.$card-width - $line-size
			return result;
		}
		return 0;
	}

	getDeviceConnectionLeftPosition(index: number) {
		let offset = 160; // scss.$card-width
		let centerd = Object.keys(this.devices).length + 1;
		let result = ((window.innerWidth - offset) / centerd) * 1;
		result += (160 - 6) / 2; // card center: scss.$card-width - $line-size
		return result;
	}

	getDeviceConnectionWidth(index: number) {
		let offset = 160; // scss.$card-width
		let pos = index;
		let centerd = Object.keys(this.devices).length + 1;
		let result = (((window.innerWidth - offset) / centerd) * pos) - (((window.innerWidth - offset) / centerd) * 1);
		return result;
	}

	devicesValue(): Array<Device> {
		if (this.devices && Object.values(this.devices).length) {
			let result: Device[] = Object.values(this.devices);
			return result.sort((a, b) => (a.name > b.name) ? 1 : -1);
		}
		return [];
	}

	onListDevice(device) {
		this.goto.emit(device);
	}

	isDevicePropertyToShow(device) {
		if (device.property && device.type !== 'OPCUA') {
			return true;
		}
	}

	getDevicePropertyToShow(device) {
		let result = '';
		if (device.property) {
			if (device.type === DeviceType.OPCUA) {
				result = 'OPC-UA'
			} else if (device.type === DeviceType.SiemensS7) {
				result = 'Port: ';
				if (device.property.port) {
					result += device.property.port;
				}
				result +=' / Rack: ';
				if (device.property.rack) {
					result += device.property.rack;
				}
				result += ' / Slot: ';
				if (device.property.slot) {
					result += device.property.slot;
				}
			} else if (device.type === DeviceType.ModbusTCP) {
				result = 'Modbus-TCP  ' + 'Slave ID: ';
				if (device.property.slaveid) {
					result += device.property.slaveid;
				}
			} else if (device.type === DeviceType.ModbusRTU) {
				result = 'Modbus-RTU  ' + 'Slave ID: ';
				if (device.property.slaveid) {
					result += device.property.slaveid;
				}
			}
		}
		return result;
	}

	getDeviceStatusColor(device) {
		if (this.devicesStatus[device.name]) {
			let milli = new Date().getTime();
			if (this.devicesStatus[device.name].last + 15000 < milli) {
				this.devicesStatus[device.name].status = 'connect-error';
				this.devicesStatus[device.name].last = new Date().getTime();
			}
			let st = this.devicesStatus[device.name].status;
			if (st === 'connect-ok') {
				return '#00b050';
			} else if (st === 'connect-error' || st === 'connect-failed') {
				return '#ff2d2d';
			} else if (st === 'connect-off' || st === 'connect-busy') {
				return '#ffc000';
			}
		}
	}

	setDeviceStatus(event) {
		this.devicesStatus[event.id] = { status: event.status, last: new Date().getTime() };
	}

	editDevice(device: Device, toremove: boolean) {
		let exist = Object.values(this.devices).filter((d: Device) => d.id !== device.id).map((d: Device) => { return d.name });
		exist.push('server');
		let tempdevice = JSON.parse(JSON.stringify(device));
		let dialogRef = this.dialog.open(DevicePropertyComponent, {
			panelClass: 'dialog-property',
			data: { device: tempdevice, remove: toremove, exist: exist, availableType: this.plugins },
			position: { top: '60px' }
		});

		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				this.dirty = true;
				if (toremove) {
					this.removeDevice(device);
					this.projectService.removeDevice(device);
				} else {
					let olddevice = JSON.parse(JSON.stringify(device));
					device.name = tempdevice.name;
					device.type = tempdevice.type;
					device.enabled = tempdevice.enabled;
					device.polling = tempdevice.polling;
					if (device.property && tempdevice.property) {
						device.property.address = tempdevice.property.address;
						device.property.port = parseInt(tempdevice.property.port);
						device.property.slot = parseInt(tempdevice.property.slot);
						device.property.rack = parseInt(tempdevice.property.rack);
						device.property.slaveid = tempdevice.property.slaveid;
						device.property.baudrate = tempdevice.property.baudrate;
						device.property.databits = tempdevice.property.databits;
						device.property.stopbits = tempdevice.property.stopbits;
						device.property.parity = tempdevice.property.parity;
						device.property.options = tempdevice.property.options;
					}
					this.projectService.setDevice(device, olddevice, result.security);
				}
			}
		});
	}
}
