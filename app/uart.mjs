// const baudRate = 4800 //115200

class CwPttUart {
	constructor(socket, options = {device, keyerPin, pttPin}) {
		this._socket = socket
		this._socket.emit('opencwptt', options)
	}

	keyerState(state) {
	}

	keyerMessage(msg) {
		this._socket.emit('msg', msg)
	}

	keyerCW(cmd) {
		this._socket.emit('key', cmd)
	}

	keyerSpeed(wpm) {
		this._socket.emit('wpm', wpm)
	}

	pttState(state) {
		this._socket.emit('ptt', state)
	}

}

class CatUart {
	constructor(socket, options = {device, baudRate}) {
		this._socket = socket
		this._socket.emit('opencat', options)
	}

	serial(baudRate) {}

	serialData(data, callback) {
		this._socket.emit('cat', data)
		callback && callback()
	}
}

export {CwPttUart, CatUart}
