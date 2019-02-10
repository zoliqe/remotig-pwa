const httpPort = 8088
const cwpttBaudRate = 4800 //115200
const allowedPins = ['dtr', 'rts']
const encoding = 'ascii'

const express = require('express')
const app = express()
const httpServer = require('http').createServer(app)
const io = require('socket.io').listen(httpServer)
const SerialPort = require('serialport')



// Starting http & https servers
app.use(express.static('app'))
// const httpServer = http.createServer(app)
httpServer.listen(httpPort, () => {
	const url = `http://localhost:${httpPort}`
	console.log(`HTTP Server running on port ${httpPort}, opening ${url}`)
	require('opn')(url)
})
///////////////////////////////////////////////////////////////////////////////////////////////////

let cat;
let cwPtt;
io.sockets.on('connection', function(socket) {
	socket.on('opencat', port => {
		cat && cat.close()
		cat = new CatUart(port)
	})
	socket.on('cat', data => cat && cat.serialData(data))

	socket.on('opencwptt', port => {
		cwPtt && cwPtt.close()
		cwPtt = new CwPttUart(port)
	})
	socket.on('msg', message => { // ASCII
		console.log('Message:', message)
	})
	socket.on('key', message => { // - . _
		console.log('Key:', message)
	})
	socket.on('wpm', wpm => cwPtt && cwPtt.keyerSpeed(wpm))
	socket.on('ptt', ptt => cwPtt && cwPtt.pttState(ptt))
})


class CwPttUart {
	constructor(options = { device, keyerPin, pttPin }) {
		this._keyerPin = options.keyerPin && allowedPins.includes(options.keyerPin) ? options.keyerPin : null
		this._pttPin = options.pttPin && allowedPins.includes(options.pttPin) ? options.pttPin : null

		// console.log('Opening CW/PTT UART', options)
		this._uart = new SerialPort(options.device, { baudRate: cwpttBaudRate },
			(err) => err && console.log('CW/PTT UART error:', err))
		this._uart.on('open', () => {
			console.log('CW/PTT UART opened:', options)
			// this._uart.on('data', (data) => console.log(`UART => ${String(data).trim()}`))
			this.pttState(false)
		})
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
		if (this._pttPin) {
			const opts = {}
			opts[this._pttPin] = state
			console.log('PTT:', opts)
			this._uart.set(opts)
		}
	}

	close() {
		this._uart && this._uart.close()
	}
}

class CatUart {
	constructor(options = { device, baudRate }) {
		// console.log('Opening TCVR CAT', options)
		this._uart = new SerialPort(options.device, { baudRate: options.baudRate },
			(err) => err && console.log('CAT UART error:', err))
		this._uart.on('open', () => console.log('CAT UART opened:', options))
		// tcvr.on('data', (data) => log(`CAT => ${data}`))
	}

	serial(baudRate) { }

	serialData(data, callback) {
		console.log('CAT serialData:', data)
		this._uart && this._uart.write(data, encoding, (err) => {
			if (err) console.log('CAT UART error:', err)
			else if (callback) callback()
		})
	}

	close() {
		this._uart && this._uart.close()
	}
}

