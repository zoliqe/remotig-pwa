
class Keyer {

	/**
	 * Use pttTail = 0 to disable PTT for CW.
	 */
	constructor({cwAdapter, pttAdapter, bufferSize = 2, pttLead = 120, pttTail = 700, pttTimeout = 5000}) {
		// this._lastKeyed = Date.now()
		this._wpm = 0
		this._bufferSize = bufferSize
		this._pttLead = pttLead
		this._pttTail = pttTail
		this._pttTimeout = pttTimeout
		this._cw = s => cwAdapter && cwAdapter.keyerCW(s)
		this._speed = v => cwAdapter && cwAdapter.keyerSpeed(v)
		this._key = state => 
			cwAdapter && cwAdapter.keyerPin != null && cwAdapter.pinState(cwAdapter.keyerPin, state)
		this._ptt = state => pttAdapter && pttAdapter.pttState(state)
		
		cwAdapter && cwAdapter.keyerState(true)
		this._ptt(false)
	}

	send(msg) {
		if (this.disabled) return

		if (msg === '.' || msg === '-') {
			const pttWasOff = this._pttTimer == null
			this.ptt(true, this._pttTail)
			if (pttWasOff/*this._lastKeyed + this._pttLead < Date.now()*/) {
				// on longer pause btwn elements send buffering spaces
				if (this._bufferSize != null) for (let i = 0; i < this._bufferSize; i++) this._cw('_')
				// cannot use async delayed calls w/o buffered msgs (FIFO) and locking during pttLead
				//			else await delay(this._pttLead) 
			}
		}

		this.ptt(true, this._pttTail)
		this._cw(msg)
		(msg === '.' || msg === '-') && this.ptt(true, this._pttTail)
		// this._lastKeyed = Date.now()
	}

	ptt(state, timeout = this._pttTimeout) {
		if (state) {
			if (!timeout) return; // disable PTT

			if (this._pttTimer != null) clearTimeout(this._pttTimer)
			this._ptt(true) // this resets powron ptt watchdog counter
			this._pttTimer = setTimeout(() => {
				this._pttTimer = null
				this._ptt(false)
			}, timeout)
			return;
		}
		this._ptt(false)
		this._pttTimer != null && clearTimeout(this._pttTimer)
		this._pttTimer = null
	}

	key(state, timeout = this._pttTimeout) {
		if (state) {
			if (!timeout) return;

			if (this._keyTimer != null) clearTimeout(this._keyTimer)
			this._key(true) // reset powron watchdog timer
			this._keyTimer = setTimeout(() => {
				this._keyTimer = null
				this._key(false)
			}, timeout)
			return;
		}
		this._key(false)
		this._keyTimer != null && clearTimeout(this._keyTimer)
		this._keyTimer = null
	}

	get wpm() {
		return this._wpm
	}

	set wpm(value) {
		this._wpm = Number(value)
		if (this.disabled) return

		// if (this._bufferSize) this._pttLead = (3600 / this._wpm) * this._bufferSize
		this._speed(this._wpm)
	}

	get disabled() {
		return this._wpm < 1
	}

}

export {Keyer}
