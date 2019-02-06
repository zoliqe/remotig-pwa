// TODO implement using sockets.io

const baudRate = 4800 //115200
const allowedPins = ['dtr', 'rts']
const encoding = 'ascii'

class CwPttUart {
	constructor(options = {device, keyerPin, pttPin}) {
	}

	keyerState(state) {
	}

	keyerCW(cmd) {
		// TODO
	}

	keyerSpeed(wpm) {
		// TODO
	}

	pttState(state) {
	}

}

class CatUart {
	constructor(device, baudRate) {
	}

	serial(baudRate) {}

	serialData(data, callback) {
	}
}

export {CwPttUart, CatUart}
