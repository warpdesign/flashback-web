import { CLIP, Color, WidescreenMode } from './intern'
import { Scaler, ScalerType, _internalScaler } from './scaler'

type AudioCallback = (param: any, stream: Int16Array, len: number) => void

interface ScalerParameters {
	type: ScalerType
	name: string
	factor: number
};

const defaultScaleParameters: ScalerParameters = {
	type: ScalerType.kScalerTypeInternal,
	name: '',
	factor: _internalScaler.factorMin + (_internalScaler.factorMax - _internalScaler.factorMin) / 2,
}

const DIR_UP = 1 << 0
const DIR_DOWN = 1 << 1
const DIR_LEFT = 1 << 2
const DIR_RIGHT = 1 << 3
const DF_FASTMODE = 1 << 0
const DF_DBLOCKS = 1 << 1
const DF_SETLIFE = 1 << 2

interface PlayerInput {
	dirMask: number
	enter: boolean
	space: boolean
	shift: boolean
	backspace: boolean
	escape: boolean

	lastChar: string

	save: boolean
	load: boolean
	stateSlot: number
	rewind: boolean

	dbgMask: number
	quit: boolean
}

class SystemStub {
	_pi: PlayerInput
	_canvas: HTMLCanvasElement
	_context: CanvasRenderingContext2D
	_imageData: ImageData
	_scaler: Scaler
	_scaleFactor: number
	_caption: string
	_texW: number
	_texH: number
	_screenBuffer: Uint8ClampedArray
	_fadeOnUpdateScreen: boolean
	_fullscreen: boolean
	_overscanColor: number
	_screenW: number
	_screenH: number
	_scalerType: ScalerType
	_widescreenMode: number
	_wideMargin: number
	_enableWidescreen: boolean
	_screenshot: number
	_audioCbData: ArrayBuffer
	_audioContext: AudioContext
	_audioPlayer: AudioWorkletNode
	_sfxPlayer: AudioWorkletNode
	_events: Event[] = new Array()
	_rgbPalette: Uint8ClampedArray = new Uint8ClampedArray(256*4)
	_darkPalette: Uint8ClampedArray = new Uint8ClampedArray(256
		*4)
	_kAudioHz: number

	constructor() {
		this._audioContext = new window.AudioContext()
		this.resumeAudio()
	}

	initCanvas(w: number, h: number) {
		// const canvas = document.createElement('canvas')
		const canvas:HTMLCanvasElement = document.getElementById('root')
		canvas.width = w
		canvas.height = h
		// document.body.appendChild(canvas)
		this._canvas = canvas
		this._context = canvas.getContext('2d')
		const styleContent = `
		canvas{
			width: ${2*w}px;
			height: ${2*h}px;
			box-shadow: 10px 10px 68px 0px rgba(0,0,0,0.75);
			border-radius: 4px;
			aspect-ratio: attr(width) / attr(height);
			margin: auto;
    		display: block;
		}
		`
		const style = document.createElement('style')
		style.type = 'text/css'
		style.textContent = styleContent
		document.head.append(style)
	}

	async initAudio() {
		try {
			this._kAudioHz = this._audioContext.sampleRate

			await this._audioContext.audioWorklet.addModule(`js/processors.js`)			
            const filterNode = this._audioContext.createBiquadFilter()
            filterNode.frequency.value = 22050

			this._sfxPlayer = new AudioWorkletNode(this._audioContext, 'sfx-processor', {
				outputChannelCount: [1],
				numberOfInputs: 0,
				numberOfOutputs: 1
			});
			this._sfxPlayer.port.onmessage = this.onSFXProcessorMessage.bind(this)
			this._sfxPlayer.port.start()

			this._audioPlayer = new AudioWorkletNode(this._audioContext, 'sound-processor', {
				outputChannelCount: [1],
				numberOfInputs: 1,
				numberOfOutputs: 1
			});
			this._audioPlayer.port.onmessage = this.onSoundProcessorMessage.bind(this)
			this._audioPlayer.port.start()

			this._sfxPlayer.connect(this._audioPlayer)
			this._audioPlayer.connect(filterNode)
			filterNode.connect(this._audioContext.destination)

			this.postMessageToSoundProcessor({
				message: 'init',
				mixingRate: this._kAudioHz,
			})

			this.postMessageToSFXProcessor({
				message: 'init',
				mixingRate: this._kAudioHz,
			})			
		} catch(e) {
			console.error("error setting up audio");
			console.dir(e)
		}
	}

	resumeAudio = () => {
		if (this._audioContext && this._audioContext.state === 'suspended') {
			this._audioContext.resume()
		}		
	}

	onSoundProcessorMessage(event) {
		console.log('Message from sound processor', event)
		debugger
	}

	onSFXProcessorMessage(event) {
		console.log('Message from sfx processor', event)
		debugger
	}

	postMessageToSoundProcessor(message) {
		if (this._audioPlayer) {
			this._audioPlayer.port.postMessage(message)
		} else {
			console.warn('Cannot send message to sound processor: not available')
		}
	}

	postMessageToSFXProcessor(message) {
		if (this._sfxPlayer) {
			this._sfxPlayer.port.postMessage(message)
		} else {
			console.warn('Cannot send message to sound processor: not available')
		}
	}	

	onKeyDown = (event) => {
		const { key } = event

		this.resumeAudio()

		switch(key) {
			case ' ':
				this._pi.space = true
				break

			case 'o':
			case 'O':
			case 'Escape':
				this._pi.escape = true
				break

			case 'Enter':
				this._pi.enter = true
				break

			case 'ArrowLeft':
				this._pi.dirMask |= DIR_LEFT
				break

			case 'ArrowRight':
				this._pi.dirMask |= DIR_RIGHT
				break
				
			case 'ArrowUp':
				this._pi.dirMask |= DIR_UP
				break
				
			case 'ArrowDown':
				this._pi.dirMask |= DIR_DOWN
				break

			case 'Shift':
				this._pi.shift = true
				break

			case 'Tab':
			case 'Backspace':
				this._pi.backspace = true
				break
		}
	}

	onKeyUp = (event) => {
		const { key } = event
		switch(key) {
			case ' ':
				this._pi.space = false
				break

				case 'Escape':
				case 'o':
				case 'O':
				this._pi.escape = false
				break

			case 'Enter':
				this._pi.enter = false
				break

			case 'ArrowLeft':
				this._pi.dirMask &= ~DIR_LEFT
				break

			case 'ArrowRight':
				this._pi.dirMask &= ~DIR_RIGHT
				break
				
			case 'ArrowUp':
				this._pi.dirMask &= ~DIR_UP
				break
				
			case 'ArrowDown':
				this._pi.dirMask &= ~DIR_DOWN
				break

			case 'Shift':
				this._pi.shift = false
				break

			case 'f':
				this.goFullscreen()
				break
		}
	}

	goFullscreen = () => {
		if (this._canvas) {
			this._canvas.classList.add('fullscreen')
			// if we go fullscreen immediately after
			// adding the class, on Safari the canvas
			// will keep its (tiny) size and won't be fullscreen.
			// so we make sure the class has been applied by
			// triggering a reflow
			this._canvas.offsetWidth
			try {
				this._canvas.requestFullscreen()
			} catch(e) {
				this._canvas.webkitRequestFullscreen()
			}
		}
	}

	initEvents() {
		document.addEventListener('keyup', this.onKbEvent)
		document.addEventListener('keydown', this.onKbEvent)
		document.addEventListener('click', this.resumeAudio)
		document.addEventListener('dblclick', this.toggleFullscreen)
		document.addEventListener('fullscreenchange', this.updateCanvasCSS)
		document.addEventListener('webkitfullscreenchange', this.updateCanvasCSS)
	}

	onKbEvent = (e) => {
		// don't prevent global browser shortcuts like reload,...
		// to happen
		if (!e.metaKey && !e.ctrlKey) {
			e.preventDefault()
		}
		this._events.push(e)
	}

	updateCanvasCSS = () => {
		if (!document.fullscreenElement && !document.webkitFullscreenElement) {
			this._canvas.classList.remove('fullscreen')
		} else {
			this._canvas.classList.add('fullscreen')
		}		
	}

	async init(title: string, w: number, h: number, fullscreen: boolean, widescreenMode: number, scalerParameters: ScalerParameters) {
		this.initCanvas(w, h)
		await this.initAudio()
		this.initEvents()
		this._scaleFactor = 1
		this._pi = {
			dirMask: 0,
			enter: false,
			space: false,
			shift: false,
			backspace: false,
			escape: false,
		
			lastChar: '',
		
			save: false,
			load: false,
			stateSlot: 0,
			rewind: false,
		
			dbgMask: 0,
			quit: false,
		}
		this._screenBuffer = null
		this._fadeOnUpdateScreen = false
		this._fullscreen = fullscreen
		this._scalerType = ScalerType.kScalerTypeInternal
		this._scaleFactor = 1
		this._scaler = null

		if (scalerParameters.name.length) {
			this.setScaler(scalerParameters)
		}
		this._rgbPalette = new Uint8ClampedArray(256 * 4)
		this._darkPalette = new Uint8ClampedArray(256 * 4)
		this._screenW = this._screenH = 0
		this._widescreenMode = widescreenMode
		this._wideMargin = 0
		this._enableWidescreen = false
		this.setScreenSize(w, h)
		this._screenshot = 1
	}

	setScaler(parameters: ScalerParameters) {
		const scalers: {
			name: string,
			type: number,
			scaler: Scaler,
		}[] = [{
			name: "point",
			type: ScalerType.kScalerTypePoint,
			scaler: null
		}, {
			name: "linear",
			type: ScalerType.kScalerTypeLinear,
			scaler: null
		},
		{
			name: "scale",
			type: ScalerType.kScalerTypeInternal,
			scaler: _internalScaler
		}]

		let found = false
		for (let i = 0; i < scalers.length; ++i) {
			if (scalers[i].name === parameters.name.toLowerCase()) {
				this._scalerType = scalers[i].type
				this._scaler = scalers[i].scaler
				found = true
				break
			}
		}
		if (!found) {
			throw 'systemStub_web::setScalers scaler not found!'
		}
		this._scaleFactor = this._scaler ? CLIP(parameters.factor, this._scaler.factorMin, this._scaler.factorMax) : 1
	}

	setScreenSize(w: number, h: number) {
		if (this._screenW === w && this._screenH === h) {
			return
		}

		this.cleanupGraphics()
		if (this._screenBuffer) {
			this._screenBuffer = null
		}
		const screenBufferSize = w * h
		this._imageData = this._context.createImageData(w, h)
		this._screenBuffer = this._imageData.data

		if (!this._screenBuffer) {
			throw(`SystemStub_Web::setScreenSize() Unable to allocate offscreen buffer, w=${w}, h=${h}`)
		}
		this._screenW = w
		this._screenH = h
		this.prepareGraphics()
	}

	setPaletteColor(color: number, r: number, g: number, b: number) {
		const index = color * 4
		// rgba
		this._rgbPalette[index] = r
		this._rgbPalette[index + 1] = g
		this._rgbPalette[index + 2] = b
		this._rgbPalette[index + 3] = 255

		this._darkPalette[index] = Math.floor(r / 4)
		this._darkPalette[index + 1] = Math.floor(g / 4)
		this._darkPalette[index + 2] = Math.floor(b / 4)
		this._darkPalette[index + 3] = 255		
	}

	setPalette(pal: Uint8Array,  n: number) {
		if (n > 256) {
			throw(`Assertion failed: ${n} < 256`)
		}
		let index = 0
		for (let i = 0; i < n; ++i) {
			this.setPaletteColor(i, pal[index], pal[index + 1], pal[index + 2])
			index += 3
		}
	}

	setPaletteEntry(i: number, c: Color) {
		this.setPaletteColor(i, c.r, c.g, c.b)
	}

	getPaletteEntry(i: number, c: Color) {
		const index = i * 4
		c.r = this._rgbPalette[index]
		c.g = this._rgbPalette[index + 1]
		c.b = this._rgbPalette[index + 2]
	}

	copyRect(x: number, y: number, w: number, h: number, buf: Uint8Array, pitch: number) {
		if (x < 0) {
			x = 0;
		} else if (x >= this._screenW) {
			return;
		}
		if (y < 0) {
			y = 0;
		} else if (y >= this._screenH) {
			return;
		}
		if (x + w > this._screenW) {
			w = this._screenW - x;
		}
		if (y + h > this._screenH) {
			h = this._screenH - y;
		}

		const pal = this._rgbPalette
		const p = this._screenBuffer
		let screenOffset = (x * 4) + (y * this._screenW * 4)
		let bufOffset = y * pitch + x
		
		for (let j = 0; j < h; ++j) {
			for (let i = 0; i < w; ++i) {
				const pos = i * 4
				const colorIndex = buf[bufOffset + i] * 4
				// r
				p[screenOffset + pos] = pal[colorIndex]
				// g
				p[screenOffset + pos + 1] = pal[colorIndex + 1]
				// b
				p[screenOffset + pos + 2] = pal[colorIndex + 2]				
				// a
				p[screenOffset + pos + 3] = pal[colorIndex + 3]
			}
			screenOffset += this._screenW * 4
			bufOffset += pitch
		}
		if (this._pi.dbgMask & DF_DBLOCKS) {
			throw('not implemented!')
		}
	}

	setOverscanColor(i: number) {
		this._overscanColor = i
	}

	cleanupGraphics() {
		// TODO
	}

	prepareGraphics() {
		this._texW = this._screenW
		this._texH = this._screenH

		let windowW = this._screenW * this._scaleFactor
		let windowH = this._screenH * this._scaleFactor

		if (this._widescreenMode !== WidescreenMode.kWidescreenNone) {
			windowW = windowH * 16 / 9;
		}

		if (this._widescreenMode !== WidescreenMode.kWidescreenNone) {
			const w = (this._widescreenMode == WidescreenMode.kWidescreenBlur) ? this._screenW : this._screenH * 16 / 9
			const h = this._screenH

			this._wideMargin = (w - this._screenW) / 2
		}
	}

	startAudio(callback: AudioCallback, param: any) {
		console.log('SystemStub::startAudio not implemented!')
	}

	hasWidescreen() {
		return this._widescreenMode !== WidescreenMode.kWidescreenNone
	}

	enableWidescreen(enable: boolean) {
		this._enableWidescreen = enable
	}

	fadeScreen() {
		this._fadeOnUpdateScreen = true
	}

	copyRectRgb24(x: number, y: number, w: number, h: number, rgb: Uint8Array) {
		if (x < 0 || x + w > this._screenW || y < 0 || y + h > this._screenH) {
			throw(`Assertion failed: ${x} >= 0 && ${x + w} <= ${this._screenW} && ${y} >= 0 && ${y + h} <= ${this._screenH}`)
		}
		const p = this._screenBuffer
		let offset = (y * this._screenW + x) * 4
		let pOffset = 0
	
		for (let j = 0; j < h; ++j) {
			for (let i = 0; i < w; ++i) {
				p[offset + (i * 4)] = rgb[pOffset + 0]
				p[offset + (i * 4) + 1] = rgb[pOffset + 1]
				p[offset + (i * 4) + 2] = rgb[pOffset + 2]
				p[offset + (i * 4) + 3] = 255
				pOffset += 3
			}
			offset += this._screenW * 4
		}
	
		if (this._pi.dbgMask & DF_DBLOCKS) {
			this.drawRect(x, y, w, h, 0xE7)
		}
	}

	async updateScreen(shakeOffset: number) {
		const ctx = this._context
		ctx.clearRect(0, 0, this._screenW, this._screenH)
		let r
		if (this._widescreenMode !== WidescreenMode.kWidescreenNone) {
			throw('not implemented!')
		} else {
			if (this._fadeOnUpdateScreen) {
				r = {
					x: 0,
					y: 0,
					w: this._screenW,
					h: this._screenH
				}
				for (let i = 1; i <= 16; ++i) {
					this._context.fillStyle = `rgba(0,0,0, ${(256 - i * 16) / 255})`
					ctx.putImageData(this._imageData, r.x, r.y)					
					ctx.fillRect(r.x, r.y, r.w, r.h)
					await this.sleep(15)
				}
				this._fadeOnUpdateScreen = false
				return
			}

			r = {
				x: 0,
				y: shakeOffset * this._scaleFactor,
				w: this._screenW,
				h: this._screenH
			}			
		}
		ctx.putImageData(this._imageData, r.x, r.y)
	}

	getTimeStamp() {
		return new Date().getTime()
	}

	async sleep(duration: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, duration))
	}

	clearWidescreen() {
		console.log('clearWidescreen does nothing')
	} 

	async processEvents() {
		let paused = false
		while (true) {
			while (this._events.length) {
				this.processEvent(this._events.shift(), paused)
				if (this._pi.quit) {
					return
				}
			}
			if (!paused) {
				break
			}
			await this.sleep(100)
		}
	}

	processEvent = (e) => {
		switch(e.type) {
			case 'keydown':
				this.onKeyDown(e)
				break

			case 'keyup':
				this.onKeyUp(e)
				break				
		}
	}

	getOutputSampleRate() {
		return this._kAudioHz
	}

	copyWidescreenLeft(w: number, h: number, buf: Uint8Array) {
		debugger
	}

	copyWidescreenRight(w: number, h: number, buf: Uint8Array) {
		debugger
	}

	copyWidescreenMirror( w: number, h: number, buf: Uint8Array) {
		debugger
		// assert(w >= _wideMargin);
	}

	copyWidescreenBlur( w: number, h: number, buf: Uint8Array) {
		debugger
		// assert(w >= _wideMargin);
	}

	drawRect(x: number, y: number, w: number, h: number, color: number) {
		const x1 = x
		const y1 = y
		const x2 = x + w - 1
		const y2 = y + h - 1
		if (x1 < 0 && x2 >= this._screenW && y1 < 0 && y2 >= this._screenH) {
			throw(`Assertion failed: ${x1} < 0 && ${x2} >= ${this._screenW} && ${y1} < 0 && ${y2} >= ${this._screenH}`)
		}
		for (let i = x1; i <= x2; ++i) {
			this._screenBuffer[(y1 * this._screenW + i) * 4] = this._screenBuffer[(y2 * this._screenW + i) * 4] = this._rgbPalette[color * 4]
			this._screenBuffer[((y1 * this._screenW + i) * 4) + 1] = this._screenBuffer[((y2 * this._screenW + i) * 4) + 1] = this._rgbPalette[(color * 4) + 1]
			this._screenBuffer[((y1 * this._screenW + i) * 4) + 2] = this._screenBuffer[((y2 * this._screenW + i) * 4) + 2] = this._rgbPalette[(color * 4) + 2]
			this._screenBuffer[((y1 * this._screenW + i) * 4) + 3] = this._screenBuffer[((y2 * this._screenW + i) * 4) + 3] = this._rgbPalette[(color * 4) + 3]
		}
		for (let j = y1; j <= y2; ++j) {
			this._screenBuffer[(j * this._screenW + x1) * 4] = this._screenBuffer[(j * this._screenW + x2) * 4] = this._rgbPalette[color * 4]
			this._screenBuffer[((j * this._screenW + x1) * 4) + 1] = this._screenBuffer[((j * this._screenW + x2) * 4) + 1] = this._rgbPalette[(color * 4) + 1]
			this._screenBuffer[((j * this._screenW + x1) * 4) + 2] = this._screenBuffer[((j * this._screenW + x2) * 4) + 2] = this._rgbPalette[(color * 4) + 2]
			this._screenBuffer[((j * this._screenW + x1) * 4) + 3] = this._screenBuffer[((j * this._screenW + x2) * 4) + 3] = this._rgbPalette[(color * 4) + 3]
		}
	}
}

export { ScalerParameters, defaultScaleParameters, PlayerInput, SystemStub, DF_FASTMODE, DF_DBLOCKS, DF_SETLIFE, DIR_UP, DIR_LEFT, DIR_RIGHT, DIR_DOWN }