import {secondsNow, log, whoIn, delay} from './utils.mjs'
import {Transceiver} from './tcvr.mjs'
import {Keyer} from './keyer.mjs'
import {tokens} from './auth.mjs'
import {
	authTimeout, hwWatchdogTimeout, heartbeat, tcvrDevice, 
	powronPins, powron, tcvrAdapter, keyerOptions
} from './config.mjs'

/////////////////////////////////////////////

const streamName = 'om4aa-k2'

const pcConfig = {
//  'iceServers': [{
//    'urls': 'stun:stun.l.google.com:19302'
//  }]
	"iceServers": [{
		"urls": ["turn:om4aa.ddns.net:5349"],
		"username":"om4aa",
		"credential":"report559"
	}]
}
const socketIoConfig = {
  transports: ['websocket'],
  reconnectionDelay: 10000,
  reconnectionDelayMax: 60000,
}
const userMediaConstraints = {audio: true, video: false}
const controlChannelConfig = {ordered: true}

////////////////////////////////////////
const tokenParam = 'token'
const devices = Object.keys(powronPins)
const State = {on: 'active', starting: 'starting', off: null, stoping: 'stoping'}
const deviceState = {}
devices.forEach(dev => deviceState[dev] = State.off)

let whoNow = null
let authTime = null
let controlChannel = null
let tcvr = null
let keyer = null
let connectionReset = false

// app.param(tokenParam, (req, res, next, value) => {
// 	const token = req.params[tokenParam] && req.params[tokenParam].toUpperCase()
// 	// log(`request token: ${token}`)
// 	req.authorized = authorize(token) || error(res, 'EAUTH', 401)
// 	next()
// })

// app.get('/status', (req, res) => res.send({ who: whoNow, devices: deviceState, authTime: authTime }))

function onControlOpen() {
	console.debug('control connect')
	// if (!req.authorized) {
	// 	log('unauthorized control, terminating connection')
	// 	ws.send('disc')
	// 	ws.terminate()
	// 	return
	// }
	connectionReset = false
	controlChannel.send('conack')
	console.info('control open')
}

function onControlClose() {
	tcvr = keyer = null
	!connectionReset && powerOff(tcvrDevice)
}

function onControlError(error) {
	console.error('controlChannel error:', error)
}

function onControlMessage(event) {
	// if (ws !== wsNow && ws.readyState === WebSocket.OPEN) {
	// 	log(`Unauthored cmd: ${msg}`)
	// 	ws.send('disc')
	// 	ws.close()
	// 	return
	// }
	authTime = secondsNow()
	// log('cmd: ' + msg)

	const msg = event.data
	if (msg == 'poweron') {
		powerOn(tcvrDevice)
		tcvr = tcvr || new Transceiver(tcvrAdapter())
		keyer = keyer || new Keyer(keyerOptions)
	} else if (msg == 'poweroff') {
		tcvr = keyer = null
		powerOff(tcvrDevice)
	} else if (['ptton', 'pttoff'].includes(msg)) {
		const state = msg.endsWith('on')
		keyer && keyer.ptt(state)
		// if (!state || keyerPin) { // ptt on only when enabled
		// 	powron.pinState(keyerPin, state)
		// 	pttTime = state ? secondsNow() : null
		// }
	} else if (['.', '-', '_'].includes(msg)) {
		keyer && keyer.send(msg)
	} else if (msg.startsWith('wpm=')) {
		keyer && (keyer.wpm = msg.substring(4))
	} else if (msg.startsWith('f=')) {
		tcvr && (tcvr.frequency = msg.substring(2))
	} else if (msg.startsWith('mode=')) {
		tcvr && (tcvr.mode = msg.substring(5))
	} else if (msg.startsWith('filter=')) {
		tcvr && (tcvr.filter = msg.substring(7))
	} else if (['preampon', 'preampoff'].includes(msg)) {
		tcvr && (tcvr.gain = msg.endsWith('on') ? tcvr.preampLevels[0] : 0)
	} else if (['attnon', 'attnoff'].includes(msg)) {
		tcvr && (tcvr.gain = msg.endsWith('on') ? (0 - tcvr.attnLevels[0]) : 0)
	} else if (['agcon', 'agcoff'].includes(msg)) {
		tcvr && (tcvr.agc = tcvr.agcTypes[msg.endsWith('on') ? 0 : 1])
	} else {
		console.warn(`ecmd: '${msg}'`)
	}
}

console.info(`Activating heartbeat every ${heartbeat} s`)
setInterval(tick, heartbeat * 1000)


const remoteAudio = document.querySelector('#remoteAudio');
let socket;
let isChannelReady = false;
let isStarted = false;
let localStream;
let pc;
let remoteStream;

function connectSocket() {
  socket = io('wss://om4aa.ddns.net', socketIoConfig)
  
  socket.on('connect', () => {
    console.info('Create stream', streamName)  
    socket.emit('create', streamName)
  })
  socket.on('reconnect', () => console.debug('socket.io reconnected'))
  socket.on('disconnect', () => console.debug('socket.io disconnected'))
  socket.on('error', error => console.error('socket.io error:', error))
  socket.on('connect_error', error => console.error('socket.io connect_error:', error))

	socket.on('created', function(stream) {
		console.info('Created stream ' + stream);
		getLocalStream()
	});

	socket.on('join', function (stream) {
		console.info('Another peer made a request to join stream ' + stream);
		isChannelReady = true;
	});

	socket.on('log', function(array) {
		console.log.apply(console, array);
	});

	// This client receives a message
	socket.on('message', function(message) {
		console.log('message:', message);
		if (message === 'got user media') {
			maybeStart();
		} else if (message.type === 'offer') {
			pc.setRemoteDescription(new RTCSessionDescription(message));
			doAnswer();
		} else if (message.type === 'answer' && isStarted) {
			pc.setRemoteDescription(new RTCSessionDescription(message));
		} else if (message.type === 'candidate' && isStarted) {
			const candidate = new RTCIceCandidate({
				sdpMLineIndex: message.label,
				candidate: message.candidate
			});
			pc.addIceCandidate(candidate);
		} else if (message === 'bye' && isStarted) {
			console.info('Session terminated.')
			stop()
		} else if (message === 'restart') {
			reset()
		}
	});
}

function sendMessage(message) {
	if (socket && socket.connected) {
		console.debug('sendMessage:', message);
		socket.emit('message', message);
	}
}

////////////////////////////////////////////////

export function stop() {
	console.debug('stoping stream')
  isStarted = false
	isChannelReady = false
	controlChannel && controlChannel.close()
	controlChannel = null
  pc && pc.close()
  pc = null
}

////////////////////////////////////////////////////

export function start() {
	if (isChannelReady || isStarted) return;
	connectSocket()

	window.onbeforeunload = _ => {
		console.info('Hanging up.')
		sendMessage('bye')
		stop()
	}
}

export function reset() {
	console.info('Session restart')
	// Do RTCPeerConnection & RTCDataChannel reconnect without tcvr powerOff
	connectionReset = true
	sendMessage('bye')
	stop()
	socket && socket.disconnect()
	setTimeout(start, 1000)
}

////////////////////////////////////////////////

function getLocalStream() {
  console.debug('Getting user media with constraints', userMediaConstraints)
  navigator.mediaDevices.getUserMedia(userMediaConstraints)
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  })
}

function gotStream(stream) {
  console.debug('Adding local stream.');
  localStream = stream;
  sendMessage('got user media');
}

function maybeStart() {
  console.debug(`>>>>>>> maybeStart(): isStarted=${isStarted}, isChannelReady=${isChannelReady}, localStream=${localStream}`);
  if (typeof localStream !== 'undefined' && isChannelReady) {
    if (isStarted) {
      console.info('Closing previous active RTCPeerConnection')
      pc && pc.close()
    }
    console.debug('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    doCall();
  }
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig)
    pc.onicecandidate = handleIceCandidate
    pc.onaddstream = handleRemoteStreamAdded
		pc.onremovestream = handleRemoteStreamRemoved
		
		controlChannel = pc.createDataChannel('control', controlChannelConfig)
		controlChannel.onopen = onControlOpen
		controlChannel.onclose = onControlClose
		controlChannel.onerror = onControlError
		controlChannel.onmessage = onControlMessage
		console.debug('Created RTCPeerConnnection', pcConfig);
  } catch (e) {
    console.error('Failed to create PeerConnection, exception: ' + e.message);
    // alert('Cannot create PeerConnection.');
  }
}

function handleRemoteStreamAdded(event) {
  console.debug('Remote stream added.', event);
  remoteStream = event.stream;
  remoteAudio.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.debug('Remote stream removed. Event: ', event);
}

function handleIceCandidate(event) {
  console.debug('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.debug('End of candidates.');
  }
}

function doCall() {
  console.debug('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage,
		error => console.error('createOffer() error:', error))
}

function doAnswer() {
  console.debug('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    error => console.error('doAnswer(): Failed to create session description: ' + error.toString())
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.debug('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}


//// Access Management
function authorize(token) {
	const who = whoIn(token)
	if (!token || !who) return false
	if (!tokens.includes(token) || (whoNow && whoNow !== who)) return false

	whoNow = who
	authTime = secondsNow()
	log(`Authored ${who}`)
	return true
}

function tick() {
	// checkPttTimeout();
	checkAuthTimeout();
}

function checkAuthTimeout() {
	if (!whoNow) return
	if (!authTime || (authTime + authTimeout) > secondsNow()) return

	const startedServices = devices.filter(service => deviceState[service] === State.on)
	if (startedServices.length == 0) {
		logout()
		return
	}
	log(`auth timeout for ${whoNow}: ${startedServices}`)
	startedServices.forEach(powerOff)
}

function disconnectOtherThan(currentWs) {
	appWs.getWss().clients
		//.filter(client => client !== currentWs && client.readyState === WebSocket.OPEN)
		.forEach(client => {
			if (client !== currentWs && client.readyState === WebSocket.OPEN) {
				log('Sending client disc')
				client.send('disc')
//				client.close()
			}
		}) // disconnect others
}

/*function executeAction(req, res, state) {
	const token = req.params[tokenParam] && req.params[tokenParam].toUpperCase()
	const service = req.params[serviceParam] && req.params[serviceParam].toUpperCase()

	// const authorized = authorize(token) || error(res, 'EAUTH')
	const result = req.authorized && (managePower(service, state) || error(res, 'ESERV'))

	if (result) {
//		serviceNow = state && service
		if (!state) whoNow = authTime = null // logout
		res.send('OK')
		res.locals.result = 'OK'
	}
	log(`..authored ${whoIn(token)} for ${service} state ${state}, result: ${res.locals.result}`)
	return result
}*/

async function powerOn(device) {
	const state = deviceState[device]
	if (state === State.stoping || state === State.starting) {
		log(`Device ${device} in progress state ${state}, ignoring start`)
		return
	}

	deviceState[device] = State.starting
	if (!managePower(device, true)) return

	if (state === State.off) { // cold start
		log(`powerOn: ${device}`)
		powron.timeout = hwWatchdogTimeout
	}

	deviceState[device] = State.on
}

async function powerOff(device) {
	deviceState[device] = State.stoping
	log(`powerOff: ${device}`)
	managePower(device, false)
	await delay(1000)
	managePower(device, false)
	await delay(2000)

	deviceState[device] = State.off
	const activeDevs = devices.filter(dev => deviceState[dev] !== State.off)
	activeDevs.length == 0 && logout()
}

function logout() {
	whoNow = authTime = null
	log('logout')
}

async function managePower(device, state) {
	if (!device || !devices.includes(device)) return false
	powronPins[device].forEach(async (pin) => powron.pinState(pin, state))
	return true
}


