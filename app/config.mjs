import {Powron, PowronSocket, PowronPins} from './powron.mjs'
import {CwPttUart, CatUart} from './uart.mjs'
import {ElecraftTcvr} from './tcvr-elecraft.mjs'
import {IcomTcvr} from './tcvr-icom.mjs'
import {YeasuTcvr} from './tcvr-yeasu.mjs'

const rigName = 'om4q-k2'

const pcConfig = {
	//  'iceServers': [{
	//    'urls': 'stun:stun.l.google.com:19302'
	//  }]
	"iceServers": [{
		"urls": ['turns:om4aa.ddns.net:25349'],
		"username": 'remotig',
		"credential": 'om4aa'
	}]
}
const socketIoConfig = {
	transports: ['websocket'],
	reconnectionDelay: 10000,
	reconnectionDelayMax: 60000,
	qth: 'om4aa.ddns.net',
}
const userMediaConstraints = { 
	video: false, 
	audio: {
  	sampleRate: 8000,
  	// sampleSize: 16,
  	channelCount: 1,
    volume: 1.0,
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false
  }
}
const controlChannelConfig = { ordered: true }

////////////////////////////////////////
const authTimeout = 30 // sec
const hwWatchdogTimeout = 120 // sec
const heartbeat = 10 // sec
const tcvrDevice = 'TCVR'

const powronPins = {'TCVR': [PowronPins.pin2, PowronPins.pin4]}

const uartSocket = io()
const powron = new Powron({
	// device: '/dev/ttyUSB0', //'/dev/ttyS0','/dev/ttyAMA0','COM14'
	keyerPin: PowronPins.pin5,
	pttPin: PowronPins.pin6,
	serialBaudRate: 4800
})

const keyerConfiguration = {
	cwAdapter: powron,
	pttAdapter: new CwPttUart(uartSocket, {device: '/dev/ttyUSB1', pttPin: 'dtr'}), //powron,
	bufferSize: 2, // letter spaces (delay before start sending dit/dah to keyer)
	pttTimeout: 5000, // milliseconds
	pttTail: 700, // millis
}

// const catAdapter = powron 
const catAdapter =  new CatUart(uartSocket, {device: '/dev/ttyUSB0', baudRate: 4800}) // uart must be opened before tcvrAdapter construction 
const tcvrAdapter = () => ElecraftTcvr.K2(catAdapter, keyerConfiguration) // deffer serial initialization
//const tcvrAdapter = () => KenwoodTcvr.TS2000(catAdapter, keyerOptions, {powerViaCat: true}) // deffer serial initialization
//const tcvrAdapter = () => YeasuTcvr.FT1000MP(catAdapter, keyerOptions) // deffer serial initialization

export {
	authTimeout, hwWatchdogTimeout, heartbeat, tcvrDevice, powronPins, 
	powron, catAdapter, tcvrAdapter, keyerConfiguration, rigName, pcConfig,
	socketIoConfig, userMediaConstraints, controlChannelConfig
}
