import {secondsNow, log, whoIn, delay} from './utils.mjs'
import {Transceiver} from './tcvr.mjs'
// import {Keyer} from './keyer.mjs'
import {
	authTimeout, hwWatchdogTimeout, heartbeat, tcvrDevice, 
	powronPins, powron, tcvrAdapter, rigName,
	pcConfig, socketIoConfig, userMediaConstraints, controlChannelConfig
} from './config.mjs'

/////////////////////////////////////////////

const tokenParam = 'token'
const devices = Object.keys(powronPins)
const State = {on: 'active', starting: 'starting', off: null, stoping: 'stoping'}
const deviceState = {}
devices.forEach(dev => deviceState[dev] = State.off)

let whoNow = null
let authTime = null
let controlChannel = null
let tcvr = null
// let keyer = null
let connectionReset = false

async function onControlOpen() {
	log('control connect')

	powerOn(tcvrDevice)
        await delay(3000) // wait for tcvr internal CPU start
	tcvr = tcvr || new Transceiver(tcvrAdapter())
        !connectionReset && (await tcvr.on())

	connectionReset = false
	controlChannel.send('conack')
	log('control open')
}

function onControlClose() {
	// tcvr = keyer = null
        !connectionReset && tcvr && tcvr.off()
	tcvr = null
	!connectionReset && powerOff(tcvrDevice)
}

function onControlError(error) {
	console.error('controlChannel error:', error)
}

function onControlMessage(event) {
	authTime = secondsNow()
	const msg = event.data
	console.debug('cmd: ' + msg)

	if (msg == 'poweron') {
		powerOn(tcvrDevice) // heartbeat for session live
//		tcvr = tcvr || new Transceiver(tcvrAdapter())
	} else if (msg === 'poweroff') {
//                tcvr && tcvr.off()
//		tcvr = null
//		powerOff(tcvrDevice)
	} else if (['ptton', 'pttoff'].includes(msg)) {
		const state = msg.endsWith('on')
		tcvr && (tcvr.ptt = state)
	} else if (['keydn', 'keyup'].includes(msg)) {
		const state = msg.endsWith('dn')
		tcvr && (tcvr.key = state)
	} else if (['.', '-', '_'].includes(msg)) {
		tcvr && tcvr.sendCw(msg)
	} else if (msg.startsWith('wpm=')) {
		tcvr && (tcvr.wpm = msg.substring(4))
	} else if (msg.startsWith('f=')) {
		tcvr && (tcvr.frequency = msg.substring(2))
	} else if (msg.startsWith('split=')) {
		tcvr && (tcvr.split = msg.substring(6))
	} else if (msg.startsWith('rit=')) {
		tcvr && (tcvr.rit = msg.substring(4))
	} else if (msg.startsWith('xit=')) {
		tcvr && (tcvr.xit = msg.substring(4))
	} else if (msg.startsWith('ritclr')) {
		tcvr && tcvr.clearRit()
	} else if (msg.startsWith('xitclr')) {
		tcvr && tcvr.clearXit()
	} else if (msg.startsWith('mode=')) {
		tcvr && (tcvr.mode = msg.substring(5))
	} else if (msg.startsWith('filter=')) {
		tcvr && (tcvr.filter = msg.substring(7))
	} else if (msg.startsWith('gain=')) {
		tcvr && (tcvr.gain = msg.substring(5))
	} else if (['preampon', 'preampoff'].includes(msg)) { // deprecated
		tcvr && (tcvr.gain = msg.endsWith('on') ? tcvr.preampLevels[0] : 0)
	} else if (['attnon', 'attnoff'].includes(msg)) { // deprecated
		tcvr && (tcvr.gain = msg.endsWith('on') ? (0 - tcvr.attnLevels[0]) : 0)
	} else if (msg.startsWith('agc=')) {
		tcvr && (tcvr.agc = msg.substring(4))
	} else if (['agcon', 'agcoff'].includes(msg)) { // deprecated
		tcvr && (tcvr.agc = tcvr.agcTypes[msg.endsWith('on') ? 0 : 1])
	} else if (msg === 'gains?') {
		tcvr && controlChannel.send(`gains=${JSON.stringify(tcvr.gainLevels)}`)
	} else if (msg === 'filters?') {
		tcvr && controlChannel.send(`filters=${JSON.stringify(tcvr.filters)}`)
	} else if (msg === 'agcs?') {
		tcvr && controlChannel.send(`agcs=${JSON.stringify(tcvr.agcTypes)}`)
	} else if (msg === 'modes?') {
		tcvr && controlChannel.send(`modes=${JSON.stringify(tcvr.modes)}`)
	} else if (msg === 'bands?') {
		tcvr && controlChannel.send(`bands=${JSON.stringify(tcvr.bands)}`)
	} else if (msg === 'info?') {
		tcvr && controlChannel.send(`info=${JSON.stringify(tcvr.info)}`)
	} else if (msg.startsWith('ping=')) {
		controlChannel.send(msg.replace('ping', 'pong'))
	} else {
		console.warn(`ecmd: '${msg}'`)
	}
}

console.info(`Activating heartbeat every ${heartbeat} s`)
setInterval(tick, heartbeat * 1000)


const remoteAudio = document.querySelector('#remoteAudio')
let socket;
let isChannelReady = false;
let isStarted = false;
let localStream;
let pc;
let remoteStream;

function connectSocket() {
	socket = io('wss://' + socketIoConfig.qth, socketIoConfig)
  
  socket.on('connect', () => {
    console.info('Open rig', rigName)  
    sendSignal('open', rigName)
  })
  socket.on('reconnect', () => console.debug('socket.io reconnected'))
  socket.on('disconnect', () => console.debug('socket.io disconnected'))
  socket.on('error', error => console.error('socket.io error:', error))
  socket.on('connect_error', error => console.error('socket.io connect_error:', error))

	socket.on('opened', rig => {
		console.info('Opened rig', rig)
		getLocalStream()
	})

	socket.on('join', op => {
		whoNow = op
		authTime = secondsNow()
		console.info(`Operator ${op} made a request to operate rig`)
		isChannelReady = true
	})

	socket.on('pi', data => sendSignal('po', data))

	socket.on('log', array => {
		console.debug.apply(console, array)
	})

	// This client receives a message
	socket.on('message', message => {
		console.debug('message:', message)
		if (message === 'ready') {
			maybeStart()
		} else if (message.type === 'offer') {
			pc.setRemoteDescription(new RTCSessionDescription(message))
			doAnswer()
		} else if (message.type === 'answer' && isStarted) {
			pc.setRemoteDescription(new RTCSessionDescription(message))
		} else if (message.type === 'candidate' && isStarted) {
			const candidate = new RTCIceCandidate({
				sdpMLineIndex: message.label,
				candidate: message.candidate
			})
			pc.addIceCandidate(candidate)
		} else if (message === 'bye') {
			console.info('Session terminated.')
			stop()
		} else if (message === 'restart') {
			console.info('Session restart')
			// Do RTCPeerConnection & RTCDataChannel reconnect without tcvr powerOff
			connectionReset = true
		}
	});
}

function sendMessage(message) {
	if (socket && socket.connected) {
		console.debug('sendMessage:', message)
		socket.emit('message', message)
	}
}

function sendSignal(signal, data) {
	if (socket && socket.connected) {
		console.debug('sendSignal:', signal, data)
		socket.emit(signal, data)
	}
}

////////////////////////////////////////////////

export function stop() {
	console.debug('stoping stream')
	remoteStream && remoteStream.getTracks().forEach(track => track.stop())
	remoteStream = null
	remoteAudio.removeAttribute("src")
	remoteAudio.removeAttribute("srcObject")
	
	isStarted = false
	isChannelReady = false

	if (controlChannel) {
		controlChannel.close()
		controlChannel.onopen = null
		// controlChannel.onclose = null
		// controlChannel.onerror = null
		controlChannel.onmessage = null
		controlChannel = null
	}

	if (pc) {
		pc.close()
		pc.onicecandidate = null
		pc.ontrack = null
		pc.onremovetrack = null
		pc = null
	}
	// powerOff(tcvrDevice) // force powerOff - is managed by controlChannel.close()
}

////////////////////////////////////////////////////

export function start() {
	if (isChannelReady || isStarted) return;
	connectSocket()
	//powron.connect()

	window.onbeforeunload = _ => {
		console.info('Hanging up.')
		sendMessage('bye')
		stop()
		sendSignal('close', rigName)
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
	console.debug('Adding local stream tracks with constraints:')
	stream.getTracks().forEach(track => console.log(track.getSettings()))
  localStream = stream
  sendMessage('ready')
}

function maybeStart() {
  console.debug(`>>>>>>> maybeStart(): isStarted=${isStarted}, isChannelReady=${isChannelReady}, localStream=${localStream}`);
  if (typeof localStream !== 'undefined' && isChannelReady) {
    if (isStarted) {
      console.info('Closing previous active RTCPeerConnection')
      pc && pc.close()
    }
    console.debug('>>>>>> creating peer connection')
    createPeerConnection()
		// pc.addStream(localStream);
		localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
    isStarted = true
    doCall()
  }
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig)
		pc.onicecandidate = handleIceCandidate
		pc.ontrack = handleRemoteTrackAdded
		pc.onremovetrack = handleRemoteTrackRemoved
		
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

function handleRemoteTrackAdded(event) {
  console.debug('Remote track added:', event)
  remoteStream = event.streams[0]
  remoteAudio.srcObject = remoteStream
}

function handleRemoteTrackRemoved(event) {
  console.debug('Remote track removed:', event);
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
// function authorize(token) {
// 	const who = whoIn(token)
// 	if (!token || !who) return false
// 	if (!tokens.includes(token) || (whoNow && whoNow !== who)) return false

// 	whoNow = who
// 	authTime = secondsNow()
// 	log(`Authored ${who}`)
// 	return true
// }

function tick() {
	// checkPttTimeout();
	checkAuthTimeout();
}

function checkAuthTimeout() {
	if (!whoNow) return
	console.debug(`checkAuthTimeout op=${whoNow} authTime=${authTime}`)
	if (!authTime || (authTime + authTimeout) > secondsNow()) return

	const startedServices = devices.filter(service => deviceState[service] === State.on)
	if (startedServices.length == 0) {
		logout()
		return
	}
	log(`auth timeout for ${whoNow}: ${startedServices}`)
	startedServices.forEach(powerOff)
}

// function disconnectOtherThan(currentWs) {
// 	appWs.getWss().clients
// 		//.filter(client => client !== currentWs && client.readyState === WebSocket.OPEN)
// 		.forEach(client => {
// 			if (client !== currentWs && client.readyState === WebSocket.OPEN) {
// 				log('Sending client disc')
// 				client.send('disc')
// //				client.close()
// 			}
// 		}) // disconnect others
// }

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
	const state = deviceState[device]
	if (state === State.off || state === State.stoping) return;

	deviceState[device] = State.stoping
	log(`powerOff: ${device}`)
	managePower(device, false)
	await delay(500)
	managePower(device, false)
	await delay(1000)

	deviceState[device] = State.off
	const activeDevs = devices.filter(dev => deviceState[dev] !== State.off)
	activeDevs.length == 0 && logout()
}

function logout() {
	whoNow = authTime = null
	log('logout')
	sendMessage('bye')
	stop()
	sendSignal('logout', rigName)
}

async function managePower(device, state) {
	if (!device || !devices.includes(device)) return false
	powronPins[device].forEach(async (pin) => powron.pinState(pin, state))
	return true
}


