// const baudRate = 4800 //115200

class CwPttUart {
	constructor(options = {device, keyerPin, pttPin}) {
		uartSocket.emit('opencwptt', options)
	}

	keyerState(state) {
	}

	keyerMessage(msg) {
		uartSocket.emit('msg', msg)
	}

	keyerCW(cmd) {
		uartSocket.emit('key', cmd)
	}

	keyerSpeed(wpm) {
		uartSocket.emit('wpm', wpm)
	}

	pttState(state) {
		uartSocket.emit('ptt', state)
	}

}

class CatUart {
	constructor(options = {device, baudRate}) {
		uartSocket.emit('opencat', options)
	}

	serial(baudRate) {}

	serialData(data, callback) {
		uartSocket.emit('cat', data)
		callback && callback()
	}
}

export {CwPttUart, CatUart}
