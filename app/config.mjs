import {Powron, PowronPins} from './powron.mjs'
import {CwPttUart, CatUart} from './uart.mjs'
import {ElecraftTcvr} from './tcvr-elecraft.mjs'
import {IcomTcvr} from './tcvr-icom.mjs'
import {YeasuTcvr} from './tcvr-yeasu.mjs'

const port = 8088
const authTimeout = 30 // sec
const hwWatchdogTimeout = 120 // sec
const heartbeat = 10 // sec
const tcvrDevice = 'TCVR'

const powronPins = {'TCVR': [PowronPins.pin2, PowronPins.pin4]}

const powron = new Powron({
	// device: '/dev/ttyUSB0', //'/dev/ttyS0','/dev/ttyAMA0','COM14'
	keyerPin: PowronPins.pin5,
	pttPin: PowronPins.pin6,
	serialBaudRate: 4800
})

const catAdapter = powron 
// const catAdapter =  new CatUart('/dev/ttyUSB2', 4800), // uart must be opened before tcvrAdapter construction 
const tcvrAdapter = () => ElecraftTcvr.K2(catAdapter) // deffer serial initialization

const keyerOptions = {
	cwAdapter: powron,
	pttAdapter: powron, //new CwPttUart({device: '/dev/ttyUSB1', pttPin: 'dtr'}), //powron,
	bufferSize: 2, // letter spaces (delay before start sending dit/dah to keyer)
	pttTimeout: 5000, // milliseconds
	pttTail: 500, // millis
}

export {
	port, authTimeout, hwWatchdogTimeout, heartbeat, tcvrDevice, powronPins, 
	powron, catAdapter, tcvrAdapter, keyerOptions
}
