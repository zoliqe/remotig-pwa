const httpPort = 8088
const baudRate = 4800 //115200
const allowedPins = ['dtr', 'rts']
const encoding = 'ascii'

console.log('Starting')
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
		console.log('opencat:', port)
		cat = new CatUart(...port)
	})
	socket.on('cat', data => cat && cat.serialData(data))

	socket.on('opencwptt', port => {
		console.log('opencwptt:', port)
		cwPtt = new CwPttUart(...port)
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
	constructor(device, keyerPin, pttPin) {
		this._keyerPin = keyerPin && allowedPins.includes(keyerPin) ? keyerPin : null
		this._pttPin = pttPin && allowedPins.includes(pttPin) ? pttPin : null

		// log(`Opening CW/PTT UART ${uartDev}`)
		this._uart = new SerialPort(device, { baudRate: baudRate },
			(err) => err && console.log(`CW/PTT UART ${err.message}`))
		this._uart.on('open', () => {
			console.log(`CW/PTT UART opened: ${device} ${baudRate}`)
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
			this._uart.set(opts)
		}
	}

}

class CatUart {
	constructor(device, baudRate) {
		// log(`Opening TCVR CAT ${tcvrDev}`)
		this._uart = new SerialPort(device, { baudRate: baudRate },
			(err) => err && console.log(`CAT UART ${err.message}`))
		this._uart.on('open', () => console.log(`CAT UART opened: ${device} ${baudRate}`))
		// tcvr.on('data', (data) => log(`CAT => ${data}`))
	}

	serial(baudRate) {}

	serialData(data, callback) {
		this._uart && this._uart.write(data, encoding, (err) => {
			if (err) console.log(`CAT UART ${err.message}`)
			else if (callback) callback()
		})
	}
}
