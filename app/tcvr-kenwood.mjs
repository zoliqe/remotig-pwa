import {bands, modes, agcTypes} from './tcvr.mjs'
import {delay} from './utils.mjs'


const _bands = [bands[160], bands[80], bands[40], bands[30], 
	bands[20], bands[17], bands[15], bands[12], bands[10]]
const _modes = [modes.CW, modes.CWR, modes.LSB, modes.USB]
const _agc = [agcTypes.FAST, agcTypes.SLOW]

const MD = {}
MD[modes.CW] = 3
MD[modes.CWR] = 7
MD[modes.LSB] = 1
MD[modes.USB] = 2
MD[modes.RTTY] = 6

const filters = {}
filters[modes.CW] = filters[modes.CWR] = ['2000', '1000', '600', '500', '400', '300', '200', '150', '100', '80', '50']
filters[modes.LSB] = filters[modes.USB] = ['2100']

class KenwoodTcvr {
	
	_splitState = false
	_rit = 0
	_xit = 0

	constructor(adapter, keyerConfiguration, options) {
		this._uart = data => adapter.serialData(data + ';')
		this.keyerConfiguration = Object.freeze(keyerConfiguration)
                this._options = options || {}
	}

	static TS2000(adapter, keyerConfiguration, options = {powerViaCat: false}) {
		// keyerConfiguration.pttTail = 0 // REMOVED due inserting buffer on each element, also error for frozen Object; don't use PTT for CW
		return new KenwoodTcvr(adapter, keyerConfiguration, options)
	}

	async init() {
                this._options.powerViaCat && this._uart('PS1')
                await delay(2000)
		this._uart('FR0') // set VFO A as RX VFO + cancel SPLIT
	}

        close() {
                this._options.powerViaCat && this._uart('PS0')
                this._uart = data => {} // do nothing
        }

	get agcTypes() {
		return _agc
	}

	get bands() {
		return _bands
	}
	
	get modes() {
		return _modes
	}

	get preamps() {
		return [20]
	}

	get attns() {
		return [10]
	}

	filters(mode) {
		return filters[mode]
	}

	set frequency(freq) {
		let cmd = 'FA000'
		if (freq < 10000000) cmd += '0'
		this._uart(cmd + freq)
	}

	set mode(mode) {
		this._uart(`MD${MD[mode]}`)
	}

	set agc(agc) {
		if (agc == agcTypes.SLOW) this._uart('GT020') // 000=OFF, 001 (min.) ~ 020 (max.)
                else this._uart('GT001')
	}

	set preamp(gain) {
		this._uart(`PA${gain > 0 ? 1 : 0}`)
	}

	set attn(attn) {
		this._uart(`RA0${attn > 0 ? 1 : 0}`)
	}

	filter(filter, mode) {
		this._uart(`FW${String(filter).padStart(4, '0')}`)
	}

	set txpower(level) {
		this._uart(`PC${String(level).padStart(3, '0')}`)
	}

	set split(value) {
		const state = value != 0
		if (state != this._splitState) {
			this._uart(`FT${state ? 1 : 0}`)
			this._splitState = state
		}
		if (!state) return

		let cmd = 'FB000'
		if (value < 10000000) cmd += '0'
		this._uart(cmd + value)
	}

	set rit(value) {
		if (!value) {
//			this.clearRit()
                        this._rit = 0
			this._uart('RT0')
			return
		}
		if (!this._rit) {
			this._xit && this.xit(0)
			this._uart('RT1')
		}
                // P1: 00000 ~ 99999 (the offset frequency in Hz)
		this._rit = value
		this._uart(`RU${String(value).padStart(5, '0')}`)
	}

	set xit(value) {
		if (!value) {
//			this.clearXit()
                        this._xit = 0
			this._uart('XT0')
			return
		}
                if (!this._xit) {
			this._rit && this.rit(0)
			this._uart('XT1')
		}
		this._xit = value
		this._uart(`RU${String(value).padStart(5, '0')}`)
	}

	_diff10(v1, v2) {
		return Math.floor(v2 / 10) - Math.floor(v1 / 10)
	}

	clearRit() {
		this._uart('RC')
		this._rit = 0
	}

	clearXit() {
		this._uart('RC')
		this._xit = 0
	}
}

export {KenwoodTcvr}
