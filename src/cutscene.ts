import { Graphics } from './graphics'
import { Buffer, Color, Language, Point, READ_BE_UINT16, ResourceType } from './intern'
import { ObjectType, Resource } from './resource'
import { SystemStub, DF_FASTMODE, DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT } from './systemstub_web'
import { Video } from './video'
import { _amigaDemoOffsetsTable, _caillouSetData, _cosTable, _creditsCutSeq, _creditsDataAmiga, _creditsDataDOS, _enTextsTable, _frTextsTable, _musicTable, _namesTableDOS, _offsetsTableAmiga, _offsetsTableDOS, _protectionShapeData, _sinTable, _ssiOffsetsTable } from './staticres'
import { DEFAULT_CONFIG, g_options } from './config'
import { ensureScriptRoot } from 'fuse-box/utils/utils'
import { dump } from './util'

type OpcodeStub = () => void

const NUM_OPCODES = 15
const TIMER_SLICE = 15

const kTextJustifyLeft = 0
const kTextJustifyAlign = 1
const kTextJustifyCenter = 2

interface SetShape {
    offset: number
    size: number
};

interface Text {
    num: number
    str: string
};

const SIN = (a: number) => _sinTable[a] << 16 >> 16
const COS = (a: number) => _cosTable[a] << 16 >> 16

const scalePoints = (pt: Point[], count: number, scale: number) => {
    if (scale !== 1) {
        throw('scalePoints')
        let i = 0
        while (count--) {
            pt[i].x *= scale
            pt[i].y *= scale
            i++
        }
    }
}

class Cutscene {
    _opcodeTable: OpcodeStub[] = [
    /* 0x00 */
	this.op_markCurPos.bind(this),
	this.op_refreshScreen.bind(this),
	this.op_waitForSync.bind(this),
	this.op_drawShape.bind(this),
	// /* 0x04 */
	this.op_setPalette.bind(this),
	this.op_markCurPos.bind(this),
	this.op_drawCaptionText.bind(this), // &Cutscene::op_drawCaptionText,
	null, // &Cutscene::op_nop,
	// /* 0x08 */
	null, // &Cutscene::op_skip3,
	this.op_refreshAll.bind(this), // &Cutscene::op_refreshAll,
	this.op_drawShapeScale.bind(this),
	this.op_drawShapeScaleRotate.bind(this),
	// /* 0x0C */
	this.op_drawCreditsText.bind(this),
	null,// &Cutscene::op_drawStringAtPos,
	this.op_handleKeys.bind(this)
    ]
    static _namesTableDOS: string[] = _namesTableDOS
    static _offsetsTableDOS: Uint16Array = _offsetsTableDOS
    static _offsetsTableAmiga: Uint16Array = _offsetsTableAmiga
    static _amigaDemoOffsetsTable: Uint8Array = _amigaDemoOffsetsTable
    static _ssiOffsetsTable: Uint8Array = _ssiOffsetsTable
    static _cosTable: Uint16Array = _cosTable
    static _sinTable: Uint16Array = _sinTable
    static _creditsDataDOS: Uint8Array = _creditsDataDOS
    static _creditsDataAmiga: Uint8Array = _creditsDataAmiga
    static _creditsCutSeq: Uint8Array = _creditsCutSeq
    static _musicTable: Uint8Array = _musicTable
    static _protectionShapeData: Uint8Array = _protectionShapeData
    static _frTextsTable: Text[] = _frTextsTable
    static _enTextsTable: Text[] = _enTextsTable
    static _caillouSetData: Uint8Array = _caillouSetData
    static kMaxPaletteSize = 32
    static kMaxShapesCount = 16

    _gfx: Graphics = new Graphics()
    _res: Resource
    _stub: SystemStub
    _vid: Video
    _patchedOffsetsTable: Uint8Array

    _id: number
    _deathCutsceneId: number
    _interrupted: boolean
    _stop: boolean
    _polPtr: Uint8Array
    _cmdPtr: Uint8Array
    _cmdPtrOffset: number
    _cmdPtrBak: Uint8Array
    _cmdPtrBakOffset: number
    _tstamp: number
    _frameDelay: number
    _newPal: boolean
    _palBuf: Uint8Array
    _baseOffset: number
    _creditsSequence: boolean
    _rotMat: number[] = new Array(4)
    _primitiveColor: number
    _clearScreen: number
    _vertices: Point[] = new Array(0x80).fill(null).map(() => ({
        x: 0,
        y: 0
    }))
    _hasAlphaColor: boolean
    _varKey: number
    _shape_ix: number
    _shape_iy: number
    _shape_ox: number
    _shape_oy: number
    _shape_cur_x: number
    _shape_cur_y: number
    _shape_prev_x: number
    _shape_prev_y: number
    _shape_count: number
    _shape_cur_x16: number
    _shape_cur_y16: number
    _shape_prev_x16: number
    _shape_prev_y16: number
    _textSep = new Uint8Array(0x14)
    _textBuf = new Uint8Array(500)
    _textCurPtr: Buffer
    _textCurBuf: Uint8Array
    _textCurBufOffset: number
    _creditsSlowText: number
    _creditsKeepText: number
    _creditsTextPosX: number
    _creditsTextPosY: number
    _creditsTextCounter: number
    _page0: Uint8Array
    _page1: Uint8Array
    _pageC: Uint8Array

    constructor(res: Resource, stub: SystemStub, vid: Video) {
        this._res = res
        this._stub = stub
        this._vid = vid
        this._patchedOffsetsTable = null
        this._palBuf = new Uint8Array(64)
    }

    static isNewLineChar(chr: number, res: Resource) {
        const nl = (res._lang === Language.LANG_JP) ? 0xD1 : 0x7C
        return chr === nl
    }

    findTextSeparators(p: Uint8Array, len: number) {
        const q = this._textSep
        let index = 0
        let ret = 0
        let pos = 0
        for (let i = 0; i < len && p[i] !== 0xA; ++i) {
            if (Cutscene.isNewLineChar(p[i], this._res)) {
                q[index++] = pos
                if (pos > ret) {
                    ret = pos
                }
                pos = 0
            } else {
                ++pos
            }
        }
        q[index++] = pos
        if (pos > ret) {
            ret = pos
        }
        q[index++] = 0
        return ret
    }

    drawText(x: number, y: number, p: Uint8Array, color: number, page: Uint8Array, textJustify: number) {
        let len = 0
        let str = new TextDecoder().decode(p)
        if (this._res._type == ResourceType.kResourceTypeMac) {
            len = str.charCodeAt(0)
            str = str.substr(1)
        } else {
            len = str.length
        }
        const dcf = this._vid._drawChar
        const fnt = (this._res._lang === Language.LANG_JP) ? Video._font8Jp : this._res._fnt
        let lastSep = 0
        if (textJustify !== kTextJustifyLeft) {
            lastSep = this.findTextSeparators(p, len)
            if (textJustify !== kTextJustifyCenter) {
                lastSep = (this._res._lang === Language.LANG_JP) ? 20 : 30
            }
        }
        const sep = this._textSep
        let index = 0
        y += 50
        x += (this._res._lang === Language.LANG_JP) ? 0 : 8
        let yPos = y
        let xPos = x
        if (textJustify !== kTextJustifyLeft) {
            xPos += ((lastSep - sep[index++]) / 2) * Video.CHAR_W
        }
        for (let i = 0; i < len && p[i] !== 0xA; ++i) {
            if (Cutscene.isNewLineChar(p[i], this._res)) {
                yPos += Video.CHAR_H
                xPos = x
                if (textJustify !== kTextJustifyLeft) {
                    xPos += ((lastSep - sep[index++]) / 2) * Video.CHAR_W
                }
            } else if (p[i] === 0x20) {
                xPos += Video.CHAR_W
            } else if (p[i] === 0x9) {
                // ignore tab
            } else {
                dcf(page, this._vid._w, xPos, yPos, fnt, color, p[i])
                xPos += Video.CHAR_W
            }
        }
    }

    async playText(str: string) {
        const c: Color = {
            r: 0,
            g: 0,
            b: 0
        }
        // background
        this._stub.setPaletteEntry(0xC0, c)
        // text
        c.r = c.g = c.b = 255;
        this._stub.setPaletteEntry(0xC1, c)
    
        let lines = 0
        for (let i = 0; i < str.length; ++i) {
            if (str[i] === '|') {
                ++lines
            }
        }
        const y = (128 - lines * 8) / 2
        this._page1.fill(0xC0, 0, this._vid._layerSize)
        this.drawText(0, y, new TextEncoder().encode(str), 0xC1, this._page1, kTextJustifyAlign)
        this._stub.copyRect(0, 0, this._vid._w, this._vid._h, this._page1, this._vid._w)
        await this._stub.updateScreen(0)
    
        while (!this._stub._pi.quit) {
            this._stub.processEvents()
            if (this._stub._pi.backspace) {
                this._stub._pi.backspace = false
                break
            }
            await this._stub.sleep(TIMER_SLICE)
        }
    }

    async play() {
        if (this._id !== 0xFFFF) {
            this._textCurBuf = null
            console.log(`Cutscene:play() _id=0x${this._id.toString(16)}`)
            this._creditsSequence = false
            this.prepare()
            const offsets = this._res.isAmiga() ? Cutscene._offsetsTableAmiga : Cutscene._offsetsTableDOS
            let cutName = offsets[this._id * 2 + 0]
            let cutOff = offsets[this._id * 2 + 1]
            console.log(`cutName=${cutName}, cutOff=${cutOff}`)
            if (cutName !== 0xFFFF) {
                switch(this._id) {
                    case 3: // keys
                        if (g_options.play_carte_cutscene) {
                            cutName = 2
                        }
                        break
                    case 8: // save checkpoints
                        break
                    case 19:
                        if (g_options.play_serrure_cutscene) {
                            cutName = 31 // SERRURE
                        }
                        break
                    case 22: // Level 2 fuse repaired
                    case 23: // switches
                    case 24: // Level 2 fuse is blown
                        if (g_options.play_asc_cutscene && !this._res._isDemo) {
                            cutName = 12 // ASC
                        }
                        break
                    case 30:
                    case 31:
                        if (g_options.play_metro_cutscene) {
                            cutName = 14 // METRO
                        }
                        break
                    case 46: // Level 2 terminal card mission
                        break
                    default:
                        console.warn(`Unknown cutscene ${this._id}`)
                        break
                }
            }
            console.log(`cutName=${cutName} (after)`)
            if (this._patchedOffsetsTable) {
                console.log('need to patch offset table')
                for (let i = 0; this._patchedOffsetsTable[i] !== 255; i += 3) {
                    if (this._patchedOffsetsTable[i] === this._id) {
                        cutName = this._patchedOffsetsTable[i + 1];
                        cutOff = this._patchedOffsetsTable[i + 2];
                        break;
                    }
                }
                console.log(`cutName=${cutName}, cutOff=${cutOff} (patch)`)
            } else {
                console.log('no need to patch offset table')                
            }

            if (g_options.use_text_cutscenes) {
                const textsTable:Text[] = (this._res._lang === Language.LANG_FR) ? Cutscene._frTextsTable : Cutscene._enTextsTable
                for (let i = 0; textsTable[i].str; ++i) {
                    if (this._id === textsTable[i].num) {
                        await this.playText(textsTable[i].str)
                        break
                    }
                }
            } else if (cutName !== 0xFFFF) {
                if (await this.load(cutName)) {
                    await this.mainLoop(cutOff)
                    this.unload()
                }
            } else if (this._id === 8 && g_options.play_caillou_cutscene) {
                await this.playSet(Cutscene._caillouSetData, 0x5E4)
            }
            this._vid.fullRefresh()
            if (this._id !== 0x3D) {
                this._id = 0xFFFF
            }
        }
    }

    async mainLoop(num: number) {
        // console.log("=================")
        // console.log('mainLoop', num)
        this._frameDelay = 5
        this._tstamp = new Date().getTime()

        const c:Color = {
            r: 0,
            g: 0,
            b: 0
        }
        for (let i = 0; i < 0x20; ++i) {
            this._stub.setPaletteEntry(0xC0 + i, c)
        }
        this._newPal = false
        this._hasAlphaColor = false
        const p:Uint8Array = this.getCommandData()
        let offset = 0
        if (this._res.isMac()) {
            this._baseOffset = READ_BE_UINT16(p.buffer, 2 + num * 2)
        } else {
            if (num !== 0) {
                offset = READ_BE_UINT16(p.buffer, 2 + num * 2)
            }
            this._baseOffset = (READ_BE_UINT16(p.buffer) + 1) * 2
        }
        this._varKey = 0
        this._cmdPtr = this._cmdPtrBak = new Uint8Array(p.buffer)
        this._cmdPtrOffset  = this._cmdPtrBakOffset = this._baseOffset + offset
        this._polPtr = this.getPolygonData()
        while (!this._stub._pi.quit && !this._interrupted && !this._stop) {
            let op = this.fetchNextCmdByte()

            if (op & 0x80) {
                break
            }
            op >>= 2
            if (op >= NUM_OPCODES) {
                throw(`Invalid cutscene opcode = 0x${op.toString(16)}`)
            }
            try {
                await this._opcodeTable[op]()
            } catch(e) {
                debugger
            }
            await this._stub.processEvents()
            if (this._stub._pi.backspace) {
                this._stub._pi.backspace = false
                this._interrupted = true
            }
        }
    }

    fetchNextCmdByte() {
        return this._cmdPtr[this._cmdPtrOffset++]
    }

    fetchNextCmdWord() {
        const i = READ_BE_UINT16(this._cmdPtr.buffer, this._cmdPtrOffset)
        this._cmdPtrOffset += 2
        return i
    }

    getCommandData() {
        return this._res._cmd
    }

    getPolygonData() {
        return this._res._pol
    }

    async sync() {
        if (this._stub._pi.quit) {
            return
        }
        if (this._stub._pi.dbgMask & DF_FASTMODE) {
            return
        }
        const delay = this._stub.getTimeStamp() - this._tstamp
        const pause = this._frameDelay * TIMER_SLICE - delay
        if (pause > 0) {
            await this._stub.sleep(pause)
        }
        this._tstamp = this._stub.getTimeStamp()
    }

    copyPalette(pal: Uint8Array, num:number) {
        const dst = this._palBuf
        let offset = 0
        if (num !== 0) {
            offset += 0x20
        }
        dst.set(pal.subarray(0, 0x20), offset)
        this._newPal = true
    }

    updatePalette() {
        if (this._newPal) {
            const p = this._palBuf
            let offset = 0
            for (let i = 0; i < 32; ++i) {
                const color = READ_BE_UINT16(p.buffer, offset)
                offset += 2
                const c:Color = Video.AMIGA_convertColor(color)
                this._stub.setPaletteEntry(0xC0 +i, c)
            }
            this._newPal = false
        }
    }

    async setPalette() {
        await this.sync()
        this.updatePalette()
        const tmp = this._page0
        this._page0 = this._page1
        this._page1 = tmp
        this._stub.copyRect(0, 0, this._vid._w, this._vid._h, this._page0, this._vid._w)
        await this._stub.updateScreen(0)
    }

    async load(cutName: number): Promise<boolean> {
        if (cutName === 0xFFFF) {
            throw(`Assertion failed: ${cutName} !== 0xFFFF`)
        }
        let name = Cutscene._namesTableDOS[cutName & 0xFF]
        const _res = this._res
        switch(_res._type) {

            case ResourceType.kResourceTypeAmiga:
                if (cutName === 7) {
                    name = "INTRO"
                } else if (cutName === 10) {
                    name = "SERRURE"
                }
                await _res.load(name, ObjectType.OT_CMP)
                if (this._id === 0x39 && _res._lang !== Language.LANG_FR) {
                    //
                    // 'espions' - '... the power which we need' caption is missing in Amiga English.
                    // fixed in DOS version, opcodes order is wrong
                    //
                    // opcode 0 pos 0x323
                    // opcode 6 pos 0x324
                    // str 0x3a
                    //
                    throw('TODO: Amiga')
                }
                break

            case ResourceType.kResourceTypeDOS:
                await _res.load(name, ObjectType.OT_CMD)
                await _res.load(name, ObjectType.OT_POL)
                break

            case ResourceType.kResourceTypeMac:
                await _res.MAC_loadCutscene(name)
                break
        }
        await _res.load_CINE()
        return !!(_res._cmd && _res._pol)
    }

    unload() {
        switch(this._res._type) {
            case ResourceType.kResourceTypeAmiga:
                this._res.unload(ObjectType.OT_CMP)
                break
            case ResourceType.kResourceTypeDOS:
                this._res.unload(ObjectType.OT_CMD)
                this._res.unload(ObjectType.OT_POL)
                break
            case ResourceType.kResourceTypeMac:
                this._res.MAC_unloadCutscene()
                break;                
        }
    }

    prepare() {
        this._page0 = this._vid._frontLayer
        this._page1 = this._vid._tempLayer
        this._pageC = this._vid._tempLayer2
        this._stub._pi.dirMask = 0
        this._stub._pi.enter = false
        this._stub._pi.space = false
        this._stub._pi.shift = false
        this._interrupted = false
        this._stop = false
        const w = 240
        const h = 128
        const x = (Video.GAMESCREEN_W - w) / 2
        const y = 50
        const sw = w * this._vid._layerScale
        const sh = h * this._vid._layerScale
        const sx = x * this._vid._layerScale
        const sy = y * this._vid._layerScale
        this._gfx.setClippingRect(sx, sy, sw, sh)
    }

    async playCredits() {
        if (this._res.isMac()) {
            console.warn('Cutscene::playCredits() unimplemented')
            return
        }
        this._textCurPtr = new Buffer(this._res.isAmiga() ? Cutscene._creditsDataAmiga.buffer : Cutscene._creditsDataDOS.buffer)
        this._textBuf[0] = 0xA
        this._creditsSequence = true
        this._creditsSlowText = 0
        this._creditsKeepText = 0
        this._creditsTextCounter = 0
        this._interrupted = false
        const cut_seq = Cutscene._creditsCutSeq
        let cut_idx = 0
        while (!this._stub._pi.quit && !this._interrupted) {
            const cut_id = cut_seq[cut_idx++]
            if (cut_id === 0xFFFF) {
                break
            }
            this.prepare()
            const offsets = this._res.isAmiga() ? Cutscene._offsetsTableAmiga : Cutscene._offsetsTableDOS
            const cutName = offsets[cut_id * 2 + 0]
            const cutOff = offsets[cut_id * 2 + 1]
            if (await this.load(cutName)) {
                await this.mainLoop(cutOff)
                this.unload()
            }
        }
        this._creditsSequence = false
    }

    op_setPalette() {
        const num = this.fetchNextCmdByte()
        const palNum = this.fetchNextCmdByte()
        const off = READ_BE_UINT16(this._polPtr.buffer, 6)
        const p = new Uint8Array(this._polPtr.buffer, off + num * 32)
        this.copyPalette(p, palNum^1)
        if (this._creditsSequence) {
            this._palBuf[0x20] = 0x0F
            this._palBuf[0x21] = 0xFF
        }
    }

    drawShapeScaleRotate(data: Buffer, zoom: number, b: number, c: number, d: number, e: number, f: number, g: number) {
        const startOffset = data.offset
        this._gfx.setLayer(this._page1, this._vid._w)
        let numVertices = data.getUint8Array()[0]
        data.offset++
        if (numVertices & 0x80) {
            let x, y, ix, iy
            const pr = new Array<Point>(2);
            const pt = this._vertices
            let index = 0
            this._shape_cur_x = ix = b + (READ_BE_UINT16(data)  << 16 >> 16)
            data.offset += 2;
            this._shape_cur_y = iy = c + (READ_BE_UINT16(data) << 16 >> 16)
            data.offset += 2
            x = READ_BE_UINT16(data) << 16 >> 16
            data.offset += 2;
            y = READ_BE_UINT16(data) << 16 >> 16
            data.offset += 2
            this._shape_cur_x16 = this._shape_ix - ix;
            this._shape_cur_y16 = this._shape_iy - iy;
            this._shape_ox = this._shape_cur_x = this._shape_ix + ((this._shape_cur_x16 * this._rotMat[0] + this._shape_cur_y16 * this._rotMat[1]) >> 8);
            this._shape_oy = this._shape_cur_y = this._shape_iy + ((this._shape_cur_x16 * this._rotMat[2] + this._shape_cur_y16 * this._rotMat[3]) >> 8)
            pr[0] = {
                x: 0,
                y: -y
            }
            pr[1] = {
                x: -x,
                y: y
            }
            if (this._shape_count === 0) {
                f -= ((this._shape_ix - this._shape_cur_x) * zoom * 128 + 0x8000) >> 16
                g -= ((this._shape_iy - this._shape_cur_y) * zoom * 128 + 0x8000) >> 16
                pt[index].x = f
                pt[index].y = g
                index++
                this._shape_cur_x16 = f << 16
                this._shape_cur_y16 = g << 16
            } else {
                this._shape_cur_x16 = this._shape_prev_x16 + (this._shape_cur_x - this._shape_prev_x) * zoom * 128
                this._shape_cur_y16 = this._shape_prev_y16 + (this._shape_cur_y - this._shape_prev_y) * zoom * 128
                pt[index].x = (this._shape_cur_x16 + 0x8000) >> 16;
                pt[index].y = (this._shape_cur_y16 + 0x8000) >> 16;
                index++ 
            }
            for (let i = 0; i < 2; ++i) {
                this._shape_cur_x += pr[i].x
                this._shape_cur_x16 += pr[i].x * zoom * 128
                pt[index].x = (this._shape_cur_x16 + 0x8000) >> 16
                this._shape_cur_y += pr[i].y
                this._shape_cur_y16 += pr[i].y * zoom * 128
                pt[index].y = (this._shape_cur_y16 + 0x8000) >> 16
                index++
            }
            this._shape_prev_x = this._shape_cur_x
            this._shape_prev_y = this._shape_cur_y
            this._shape_prev_x16 = this._shape_cur_x16
            this._shape_prev_y16 = this._shape_cur_y16
            const po:Point = {
                x: this._vertices[0].x + d + this._shape_ix,
                y: this._vertices[0].y + e + this._shape_iy
            }

            const rx = this._vertices[0].x - this._vertices[2].x
            const ry = this._vertices[0].y - this._vertices[1].y
            scalePoints([po], 1, this._vid._layerScale);
            this._gfx.drawEllipse(this._primitiveColor, this._hasAlphaColor, po, rx, ry)
        } else if (numVertices === 0) {
            // TODO
            debugger
        } else {
            let x, y, a, shape_last_x, shape_last_y
            const tempVertices = new Array<Point>(40)
            for (let i = 0; i < 40; ++i)
                tempVertices[i] = {
                    x: 0,
                    y: 0,
                }
            this._shape_cur_x = b + (READ_BE_UINT16(data) << 16 >> 16)
            data.offset += 2
            x = this._shape_cur_x
            this._shape_cur_y = c + (READ_BE_UINT16(data) << 16 >> 16)
            data.offset += 2
            y = this._shape_cur_y
            this._shape_cur_x16 = this._shape_ix - x
            this._shape_cur_y16 = this._shape_iy - y

            a = this._shape_ix + ((this._rotMat[0] * this._shape_cur_x16 + this._rotMat[1] * this._shape_cur_y16) >> 8)
            if (this._shape_count == 0) {
                this._shape_ox = a
            }
            this._shape_cur_x = shape_last_x = a
            a = this._shape_iy + ((this._rotMat[2] * this._shape_cur_x16 + this._rotMat[3] * this._shape_cur_y16) >> 8)
            if (this._shape_count == 0) {
               this. _shape_oy = a
            }
            this._shape_cur_y = shape_last_y = a

            let ix = x
            let iy = y
            let pt2 = 0
            let sx = 0
            for (let n = numVertices - 1; n >= 0; --n) {
                x = (data.getUint8Array()[0] << 24 >>24) + sx
                data.offset++
                y = (data.getUint8Array()[0] << 24 >>24)
                data.offset++
                if (y === 0 && n !== 0 && data.getUint8Array()[1] === 0) {
                    sx = x
                    --numVertices
                } else {
                    ix += x
                    iy += y
                    sx = 0
                    this._shape_cur_x16 = this._shape_ix - ix
                    this._shape_cur_y16 = this._shape_iy - iy
                    a = this._shape_ix + ((this._rotMat[0] * this._shape_cur_x16 + this._rotMat[1] * this._shape_cur_y16) >> 8)
                    tempVertices[pt2].x = a - shape_last_x
                    shape_last_x = a;
                    a = this._shape_iy + ((this._rotMat[2] * this._shape_cur_x16 + this._rotMat[3] * this._shape_cur_y16) >> 8);
                    tempVertices[pt2].y = a - shape_last_y
                    shape_last_y = a
                    ++pt2;
                }
            }
            const pt = this._vertices
            let index = 0
            if (this._shape_count == 0) {
                ix = this._shape_ox
                iy = this._shape_oy
                f -= (((this._shape_ix - ix) * zoom * 128) + 0x8000) >> 16
                g -= (((this._shape_iy - iy) * zoom * 128) + 0x8000) >> 16
                pt[index].x = f + this._shape_ix + d
                pt[index].y = g + this._shape_iy + e
                ++index
                this._shape_cur_x16 = f << 16
                this._shape_cur_y16 = g << 16
            } else {
                this._shape_cur_x16 = this._shape_prev_x16 + ((this._shape_cur_x - this._shape_prev_x) * zoom * 128)
                pt[index].x = this._shape_ix + d + ((this._shape_cur_x16 + 0x8000) >> 16)
                this._shape_cur_y16 = this._shape_prev_y16 + ((this._shape_cur_y - this._shape_prev_y) * zoom * 128)
                pt[index].y = this._shape_iy + e + ((this._shape_cur_y16 + 0x8000) >> 16)
                ++index
            }
            for (let i = 0; i < numVertices; ++i) {
                this._shape_cur_x += tempVertices[i].x
                this._shape_cur_x16 += tempVertices[i].x * zoom * 128
                pt[index].x = d + this._shape_ix + ((this._shape_cur_x16 + 0x8000) >> 16)
                this._shape_cur_y += tempVertices[i].y
                this._shape_cur_y16 += tempVertices[i].y * zoom * 128
                pt[index].y = e + this._shape_iy + ((this._shape_cur_y16 + 0x8000) >> 16)
                ++index
            }

            this._shape_prev_x = this._shape_cur_x
            this._shape_prev_y = this._shape_cur_y
            this._shape_prev_x16 = this._shape_cur_x16
            this._shape_prev_y16 = this._shape_cur_y16
            scalePoints(this._vertices, numVertices + 1, this._vid._layerScale)
            this._gfx.drawPolygon(this._primitiveColor, this._hasAlphaColor, this._vertices, numVertices + 1)            
        }
        data.offset = startOffset
    }

    drawShapeScale(data: Buffer, zoom: number, b: number, c: number, d: number, e: number, f: number, g: number) {
        const startOffset = data.offset
        this._gfx.setLayer(this._page1, this._vid._w)
        let numVertices = data.getUint8Array()[0]
        data.offset++
        if (numVertices & 0x80) {
            let x, y
            const pt = this._vertices
            let index = 0
            const pr:[Point, Point] = [{
                x: 0,
                y: 0
            }, {
                x: 0,
                y: 0
            }]
            this._shape_cur_x = b + (READ_BE_UINT16(data) << 16 >> 16)
            data.offset += 2
            this._shape_cur_y = c + (READ_BE_UINT16(data) << 16 >> 16)
            data.offset += 2
            x = READ_BE_UINT16(data) << 16 >> 16
            data.offset += 2
            y = READ_BE_UINT16(data) << 16 >> 16
            data.offset += 2
            this._shape_cur_x16 = 0
            this._shape_cur_y16 = 0
            pr[0].x =  0
            pr[0].y = -y
            pr[1].x = -x
            pr[1].y =  y
            if (this._shape_count == 0) {
                f -= ((((this._shape_ix - this._shape_ox) * zoom) * 128) + 0x8000) >> 16
                g -= ((((this._shape_iy - this._shape_oy) * zoom) * 128) + 0x8000) >> 16
                pt[index].x = f
                pt[index].y = g
                index++
                this._shape_cur_x16 = f << 16
                this._shape_cur_y16 = g << 16
            } else {
                this._shape_cur_x16 = this._shape_prev_x16 + ((this._shape_cur_x - this._shape_prev_x) * zoom) * 128
                pt[index].x = (this._shape_cur_x16 + 0x8000) >> 16
                this._shape_cur_y16 = this._shape_prev_y16 + ((this._shape_cur_y - this._shape_prev_y) * zoom) * 128
                pt[index].y = (this._shape_cur_y16 + 0x8000) >> 16
                index++
            }
            for (let i = 0; i < 2; ++i) {
                this._shape_cur_x += pr[i].x
                this._shape_cur_x16 += pr[i].x * zoom * 128
                pt[index].x = (this._shape_cur_x16 + 0x8000) >> 16
                this._shape_cur_y += pr[i].y
                this._shape_cur_y16 += pr[i].y * zoom * 128
                pt[index].y = (this._shape_cur_y16 + 0x8000) >> 16
                index++
            }
            this._shape_prev_x = this._shape_cur_x
            this._shape_prev_y = this._shape_cur_y
            this._shape_prev_x16 = this._shape_cur_x16
            this._shape_prev_y16 = this._shape_cur_y16
            const po: Point = {
                x: this._vertices[0].x + d + this._shape_ix,
                y: this._vertices[0].y + e + this._shape_iy
            }
            let rx = this._vertices[0].x - this._vertices[2].x
            let ry = this._vertices[0].y - this._vertices[1].y
            scalePoints([po], 1, this._vid._layerScale);
            this._gfx.drawEllipse(this._primitiveColor, this._hasAlphaColor, po, rx, ry)
        } else if (numVertices === 0) {
            // TODO
            debugger
        } else {
            const pt = this._vertices
            let index = 0
            let ix, iy
            this._shape_cur_x = ix = (READ_BE_UINT16(data) << 16 >> 16) + b
            data.offset += 2
            this._shape_cur_y = iy = (READ_BE_UINT16(data) << 16 >> 16) + c
            data.offset += 2
            if (this._shape_count === 0) {
                f -= ((((this._shape_ix - this._shape_ox) * zoom) * 128) + 0x8000) >> 16
                g -= ((((this._shape_iy - this._shape_oy) * zoom) * 128) + 0x8000) >> 16
                pt[index].x = f + this._shape_ix + d
                pt[index].y = g + this._shape_iy + e
                index++
                this._shape_cur_x16 = f << 16;
                this._shape_cur_y16 = g << 16;
            } else {
                this._shape_cur_x16 = this._shape_prev_x16 + ((this._shape_cur_x - this._shape_prev_x) * zoom) * 128
                this._shape_cur_y16 = this._shape_prev_y16 + ((this._shape_cur_y - this._shape_prev_y) * zoom) * 128;
                pt[index].x = ix = ((this._shape_cur_x16 + 0x8000) >> 16) + this._shape_ix + d
                pt[index].y = iy = ((this._shape_cur_y16 + 0x8000) >> 16) + this._shape_iy + e
                index++
            }
            let n = numVertices -1
            ++numVertices
            let sx = 0
            for (; n >= 0; --n) {
                ix = (data.getUint8Array()[0] << 24 >>24) + sx
                data.offset++
                iy = (data.getUint8Array()[0] << 24 >>24)
                data.offset++
                if (iy === 0 && n !== 0 && (data.getUint8Array()[1]) === 0) {
                    sx = ix
                    --numVertices
                } else {
                    sx = 0
                    this._shape_cur_x += ix
                    this._shape_cur_y += iy
                    this._shape_cur_x16 += ix * zoom * 128
                    this._shape_cur_y16 += iy * zoom * 128
                    pt[index].x = ((this._shape_cur_x16 + 0x8000) >> 16) + this._shape_ix + d
                    pt[index].y = ((this._shape_cur_y16 + 0x8000) >> 16) + this._shape_iy + e
                    index++
                }
            }
            this._shape_prev_x = this._shape_cur_x
            this._shape_prev_y = this._shape_cur_y
            this._shape_prev_x16 = this._shape_cur_x16
            this._shape_prev_y16 = this._shape_cur_y16
            scalePoints(this._vertices, numVertices, this._vid._layerScale)
            this._gfx.drawPolygon(this._primitiveColor, this._hasAlphaColor, this._vertices, numVertices)
        }
        data.offset = startOffset
    }

    async op_refreshAll() {
        this._frameDelay = 5
        await this.setPalette()
        this.swapLayers()
        this._creditsSlowText = 0xFF
        this.op_handleKeys()
    }

    op_drawShapeScale() {
        this._shape_count = 0
        let x = 0
        let y = 0
        let shapeOffset = this.fetchNextCmdWord()
        if (shapeOffset & 0x8000) {
            x = this.fetchNextCmdWord() << 16 >> 16
            y = this.fetchNextCmdWord() << 16 >> 16
        }
        let zoom = (this.fetchNextCmdWord() + 512) % 65536
        this._shape_ix = this.fetchNextCmdByte()
        this._shape_iy = this.fetchNextCmdByte()

        const shapeOffsetTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x02))
        const shapeDataTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x0E))
        const verticesOffsetTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x0A))
        const verticesDataTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x12))
        
        const shapeData = shapeDataTable.from(READ_BE_UINT16(shapeOffsetTable, (shapeOffset & 0x7FF) * 2))
        let primitiveCount = READ_BE_UINT16(shapeData)
        shapeData.offset += 2

        if (primitiveCount !== 0) {
            let verticesOffset = READ_BE_UINT16(shapeData)
            let dx = 0
            let dy = 0
            if (verticesOffset & 0x8000) {
                // cast uint16 to int16
                dx = READ_BE_UINT16(shapeData, 2) << 16 >> 16
                dy = READ_BE_UINT16(shapeData, 4) << 16 >> 16
            }

            let p = verticesDataTable.from(READ_BE_UINT16(verticesOffsetTable, (verticesOffset & 0x3FFF) * 2) + 1)

            this._shape_ox = (READ_BE_UINT16(p) << 16 >> 16) + dx
            p.offset += 2
            this._shape_oy = (READ_BE_UINT16(p) << 16 >> 16) + dy
            p.offset += 2

            while (primitiveCount--) {
                verticesOffset = READ_BE_UINT16(shapeData)
                shapeData.offset += 2
                p = verticesDataTable.from(READ_BE_UINT16(verticesOffsetTable, (verticesOffset & 0x3FFF) * 2))
                dx = 0
                dy = 0

                if (verticesOffset & 0x8000) {
                    dx = READ_BE_UINT16(shapeData) << 16 >> 16
                    shapeData.offset += 2
                    dy = READ_BE_UINT16(shapeData) << 16 >> 16
                    shapeData.offset += 2
                }
                this._hasAlphaColor = (verticesOffset & 0x4000) !== 0
                let color = shapeData.getUint8Array()[0]
                shapeData.offset++
                if (this._clearScreen === 0) {
                    color += 0x10
                }
                this._primitiveColor = 0xC0 + color
                this.drawShapeScale(p, zoom, dx, dy, x, y, 0, 0)
                ++this._shape_count
            }
        }
    }

    op_drawShapeScaleRotate() {
        this._shape_count = 0

        let x = 0
        let y = 0
        let shapeOffset = this.fetchNextCmdWord()
        if (shapeOffset & 0x8000) {
            x = this.fetchNextCmdWord() << 16 >> 16
            y = this.fetchNextCmdWord() << 16 >> 16
        }

        let zoom = 512
        if (shapeOffset & 0x4000) {
            zoom = (zoom + this.fetchNextCmdWord()) % 65536
        }
        this._shape_ix = this.fetchNextCmdByte()
        this._shape_iy = this.fetchNextCmdByte()

        let r1, r2, r3
        r1 = this.fetchNextCmdWord()
        r2 = 180
        if (shapeOffset & 0x2000) {
            r2 = this.fetchNextCmdWord()
        }
        r3 = 90
        if (shapeOffset & 0x1000) {
            r3 = this.fetchNextCmdWord()
        }
        this.setRotationTransform(r1, r2, r3)

        const shapeOffsetTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x02))
        const shapeDataTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x0E))
        const verticesOffsetTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x0A))
        const verticesDataTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x12))
        
        const shapeData = shapeDataTable.from(READ_BE_UINT16(shapeOffsetTable, (shapeOffset & 0x7FF) * 2))
        let primitiveCount = READ_BE_UINT16(shapeData)
        shapeData.offset += 2
    
        while (primitiveCount--) {
            let verticesOffset = READ_BE_UINT16(shapeData)
            shapeData.offset += 2
            const p = verticesDataTable.from(READ_BE_UINT16(verticesOffsetTable, (verticesOffset & 0x3FFF) * 2))
            let dx = 0
            let dy = 0
            if (verticesOffset & 0x8000) {
                dx = READ_BE_UINT16(shapeData) << 16 >> 16
                shapeData.offset += 2
                dy = READ_BE_UINT16(shapeData) << 16 >> 16
                shapeData.offset += 2
            }
            this._hasAlphaColor = (verticesOffset & 0x4000) !== 0
            let color = shapeData.getUint8Array()[0]
            shapeData.offset++
            if (this._clearScreen === 0) {
                color += 0x10 // 2nd pal buf
            }
            this._primitiveColor = 0xC0 + color
            this.drawShapeScaleRotate(p, zoom, dx, dy, x, y, 0, 0)
            ++this._shape_count
        }
    }
    
    setRotationTransform(a: number, b: number, c: number) {
        // identity a:0 b:180 c:90
        let sin_a = SIN(a)
        let cos_a = COS(a)
        let sin_c = SIN(c)
        let cos_c = COS(c)
        let sin_b = SIN(b)
        let cos_b = COS(b)
        this._rotMat[0] = ((cos_a * cos_b) >> 8) - ((((cos_c * sin_a) >> 8) * sin_b) >> 8)
        this._rotMat[1] = ((sin_a * cos_b) >> 8) + ((((cos_c * cos_a) >> 8) * sin_b) >> 8)
        this._rotMat[2] = ( sin_c * sin_a) >> 8
        this._rotMat[3] = (-sin_c * cos_a) >> 8
    }

    async op_markCurPos() {
        this._cmdPtrBak = this._cmdPtr
        this._cmdPtrBakOffset = this._cmdPtrOffset
        this.drawCreditsText()
        this._frameDelay = 5
        await this.setPalette()
        this.swapLayers()
        this._creditsSlowText = 0
    }

    op_drawCaptionText() {
        const strId = this.fetchNextCmdWord()
        if (!this._creditsSequence) {
            // 'espions' - ignore last call, allows caption to be displayed longer on the screen
            if (this._id === 0x39 && strId === 0xFFFF) {
                if ((this._res.isDOS() && (this._cmdPtr.byteOffset - this._cmdPtrBak.byteOffset) === 0x10) || (this._res.isAmiga() && (this._cmdPtr.byteOffset - this.getCommandData().byteOffset) === 0x9F3)) {
                    this._frameDelay = 100
                    this.setPalette()
                    return
                }
            }
    
            const h = 45 * this._vid._layerScale
            const y = Video.GAMESCREEN_H * this._vid._layerScale - h

            this._pageC.fill(0xC0, y * this._vid._w, y * this._vid._w + h * this._vid._w)
            this._page1.fill(0xC0, y * this._vid._w, y * this._vid._w + h * this._vid._w)
            this._page0.fill(0xC0, y * this._vid._w, y * this._vid._w + h * this._vid._w)
            if (strId !== 0xFFFF) {
                const str = this._res.getCineString(strId)
                if (str) {
                    this.drawText(0, 129, str, 0xEF, this._page1, kTextJustifyAlign)
                    this.drawText(0, 129, str, 0xEF, this._pageC, kTextJustifyAlign)
                }
            }
        }
    }

    op_refreshScreen() {
        this._clearScreen = this.fetchNextCmdByte()
        if (this._clearScreen !== 0) {
            this.swapLayers()
            this._creditsSlowText = 0
        }
    }

    async op_waitForSync() {
        if (this._creditsSequence) {
            const n = this.fetchNextCmdByte() * 2
            throw('op_waitForSync -> creditsSequence not implemented')
            // do {
            //     this._creditsSlowText = 0xFF
            //     this._frameDelay = 3
            // }
        } else {
            this._frameDelay = this.fetchNextCmdByte() * 4
            await this.sync()
        }
    }

    drawShape(data: Buffer, x: number, y: number) {
        const startOffset = data.offset
        this._gfx.setLayer(this._page1, this._vid._w)
        let numVertices = data.getUint8Array()[0]
        data.offset++
        if (numVertices & 0x80) {
            const pt: Point = {
                x: READ_BE_UINT16(data) + x,
                y: READ_BE_UINT16(data, 2) + y,
            }
            data.offset += 4
            const rx = READ_BE_UINT16(data)
            data.offset += 2
            const ry = READ_BE_UINT16(data)
            data.offset += 2
            scalePoints([pt], 1, this._vid._layerScale)
            this._gfx.drawEllipse(this._primitiveColor, this._hasAlphaColor, pt, rx, ry)
        } else if (numVertices === 0) {
            const pt:Point = {
                x: READ_BE_UINT16(data),
                y: READ_BE_UINT16(data, 2)                
            }
            data.offset += 4
            scalePoints([pt], 1, this._vid._layerScale)
            this._gfx.drawPoint(this._primitiveColor, pt)
        } else {
            const pt = this._vertices
            let index = 0
            let ix = READ_BE_UINT16(data)
            data.offset += 2
            let iy = READ_BE_UINT16(data)    
            data.offset += 2    
            pt[index].x = ix + x
            pt[index].y = iy + y
            index++
            let n = numVertices - 1
            ++numVertices
            for (; n >= 0; --n) {
                const array = data.getUint8Array()
                const dx = array[0] << 24 >>24
                const dy = array[1] << 24 >>24
                const val = array[3]
                data.offset += 2
                if (dy === 0 && n !== 0 && val === 0) {
                    ix += dx
                    --numVertices
                } else {
                    ix += dx
                    iy += dy
                    pt[index].x = ix + x
                    pt[index].y = iy + y
                    index++
                }
            }
            scalePoints(this._vertices, numVertices, this._vid._layerScale)
            this._gfx.drawPolygon(this._primitiveColor, this._hasAlphaColor, this._vertices, numVertices)
        }
        data.offset = startOffset
    }

    op_drawShape() {
        let x = 0
        let y = 0
        let shapeOffset = this.fetchNextCmdWord()

        if (shapeOffset & 0x8000) {
            x = this.fetchNextCmdWord() << 16 >> 16
            y = this.fetchNextCmdWord() << 16 >> 16
        }

        const shapeOffsetTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x02))
        const shapeDataTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x0E))
        const verticesOffsetTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x0A))
        const verticesDataTable = new Buffer(this._polPtr.buffer, READ_BE_UINT16(this._polPtr.buffer, 0x12))
        
        const shapeData = shapeDataTable.from(READ_BE_UINT16(shapeOffsetTable, (shapeOffset & 0x7FF) * 2))
        let primitiveCount = READ_BE_UINT16(shapeData)
        shapeData.offset += 2

        while(primitiveCount--) {
            const verticesOffset = READ_BE_UINT16(shapeData)
            shapeData.offset += 2
            const primitiveVertices = verticesDataTable.from(READ_BE_UINT16(verticesOffsetTable, (verticesOffset & 0x3FFF) * 2))
            let dx = 0
            let dy = 0
            if (verticesOffset & 0x8000) {
                // cast uint16 to int16
                dx = READ_BE_UINT16(shapeData) << 16 >> 16
                shapeData.offset += 2
                dy = READ_BE_UINT16(shapeData) << 16 >> 16
                shapeData.offset += 2
            }
            this._hasAlphaColor = (verticesOffset & 0x4000) !== 0
            let color = shapeData.getUint8Array()[0]
            shapeData.offset++
            if (this._clearScreen === 0) {
                color += 0x10
            }
            this._primitiveColor = 0xC0 + color
            this.drawShape(primitiveVertices, x + dx, y + dy)
        }
        if (this._clearScreen !== 0) {
            this._pageC.set(this._page1.subarray(0, this._vid._layerSize))
        }
    }

    swapLayers() {
        if (this._clearScreen === 0) {
            this._page1.set(this._pageC.subarray(0, this._vid._layerSize))
        } else {
            this._page1.fill(0xC0, 0, this._vid._layerSize)
        }
    }

    op_drawCreditsText() {
        this._creditsSlowText = 0xFF
        if (this._textCurBuf && this._textCurBufOffset === 0) {
            throw("TODO: _textCurBuf")
            ++this._creditsTextCounter
        } else {

        }
        this._page1.set(this._page0.subarray(0, this._vid._layerSize))
        this._frameDelay = 10
        this.setPalette()
    }

    op_handleKeys() {
        while(1) {
            const key_mask = this.fetchNextCmdByte()
            if (key_mask === 0xFF) {
                return
            }
            let b = true
            switch(key_mask) {
                case 1:
                    b = (this._stub._pi.dirMask & DIR_UP) != 0
                    break;
                case 2:
                    b = (this._stub._pi.dirMask & DIR_DOWN) != 0
                    break;
                case 4:
                    b = (this._stub._pi.dirMask & DIR_LEFT) != 0
                    break;
                case 8:
                    b = (this._stub._pi.dirMask & DIR_RIGHT) != 0
                    break;
                case 0x80:
                    b = this._stub._pi.space || this._stub._pi.enter || this._stub._pi.shift
                    break;
            }
            if (b) {
                break;
            }
            this._cmdPtrOffset += 2
        }
        this._stub._pi.dirMask = 0
        this._stub._pi.enter = false;
        this._stub._pi.space = false;
        this._stub._pi.shift = false;
        let n = this.fetchNextCmdWord() << 16 >> 16
        if (n < 0) {
            n = -n - 1
            if (this._varKey == 0) {
                this._stop = true
                return
            }
            if (this._varKey !== n) {
                this._cmdPtr = this._cmdPtrBak
                this._cmdPtrOffset = this._cmdPtrBakOffset
                return
            }
            this._varKey = 0
            --n
            this._cmdPtr = this.getCommandData()
            this._cmdPtrOffset = 0
            n = READ_BE_UINT16(this._cmdPtr, n * 2 + 2)
        }
        if (this._res.isMac()) {
            this._cmdPtr = this.getCommandData()
            this._cmdPtrOffset = 0
            this._baseOffset = READ_BE_UINT16(this._cmdPtr, 2 + n * 2)
            n = 0
        }
        this._cmdPtr = this._cmdPtrBak = this.getCommandData()
        this._cmdPtrBakOffset = this._cmdPtrOffset =  n + this._baseOffset
    }

    drawCreditsText() {
        if (this._creditsSequence) {
            throw('Cutscene::drawCreditsText not implemented!')
            if (this._creditsKeepText !== 0) {
                if (this._creditsSlowText === 0) {
                    this._creditsKeepText = 0
                } else {
                    return
                }
            }
            if (this._creditsTextCounter <= 0) {
                const code = this._textCurPtr[0]
                if (code === 0xFF) {
                    throw('TODO: drawCreditsText')
                } else if (code === 0xFE) {
    
                }
            }            
        }
    }

    static readSetShapeOffset(p: Uint8Array, offset: number) {
        const count = READ_BE_UINT16(p, offset)
        offset += 2
        for (let i = 0; i < count - 1; ++i) {
            offset += 5; // shape_marker
            const verticesCount = p[offset++]
            offset += 6
            if (verticesCount == 255) {
                offset += 4 // ellipse
            } else {
                offset += verticesCount * 4 // polygon
            }
        }
        return offset
    }

    static readSetPalette(p: Uint8Array, offset: number, palette: Uint16Array) {
        offset += 12
        for (let i = 0; i < 16; ++i) {
            const color = READ_BE_UINT16(p, offset)
            offset += 2
            palette[i] = color
        }
    }

    drawSetShape(p: Uint8Array, offset: number, x: number, y: number, paletteLut: Uint8Array) {
        const count = READ_BE_UINT16(p, offset)
        offset += 2
        for (let i = 0; i < count - 1; ++i) {
            offset += 5 // shape_marker
            const verticesCount = p[offset++]
            const ix = READ_BE_UINT16(p, offset) << 16 >> 16
            offset += 2
            const iy = READ_BE_UINT16(p, offset) << 16 >> 16
            offset += 2
            const color = paletteLut[p[offset]]
            offset += 2
    
            if (verticesCount === 255) {
                let rx = READ_BE_UINT16(p, offset) << 16 >> 16
                offset += 2;
                let ry = READ_BE_UINT16(p, offset) << 16 >> 16
                offset += 2
                let pt: Point = {
                    x: x + ix,
                    y: y + iy
                }

                scalePoints([pt], 1, this._vid._layerScale)
                this._gfx.drawEllipse(color, false, pt, rx, ry)
            } else {
                const shape = i
                for (let i = 0; i < verticesCount; ++i) {
                    this._vertices[i].x = x + (READ_BE_UINT16(p, offset) << 16 >> 16)
                    offset += 2
                    this._vertices[i].y = y + (READ_BE_UINT16(p, offset) << 16 >> 16)
                    offset += 2
                }
                scalePoints(this._vertices, verticesCount, this._vid._layerScale)
                this._gfx.drawPolygon(color, false, this._vertices, verticesCount)
            }
        }
    }

    async playSet(p: Uint8Array, offset: number) {
        const backgroundShapes: SetShape[] = new Array(Cutscene.kMaxShapesCount).fill(null).map(() => ({
            offset: 0,
            size: 0
        }))
        const bgCount = READ_BE_UINT16(p, offset)
        offset += 2
        if (bgCount > Cutscene.kMaxShapesCount) {
            throw(`Assertion failed: ${bgCount} > ${Cutscene.kMaxShapesCount}`)
        }

        for (let i = 0; i < bgCount; ++i) {
            let nextOffset = Cutscene.readSetShapeOffset(p, offset)
            backgroundShapes[i].offset = offset
            backgroundShapes[i].size = nextOffset - offset
            offset = nextOffset + 45
        }
        const foregroundShapes:SetShape[] = new Array(Cutscene.kMaxShapesCount).fill(null).map(() => ({
            offset: 0,
            size: 0
        }))
        const fgCount = READ_BE_UINT16(p, offset)
        offset += 2

        if (fgCount > Cutscene.kMaxShapesCount) {
            throw(`Assertion failed: ${fgCount} > ${Cutscene.kMaxShapesCount}`)
        }

        for (let i = 0; i < fgCount; ++i) {
            const nextOffset = Cutscene.readSetShapeOffset(p, offset)
            foregroundShapes[i].offset = offset
            foregroundShapes[i].size = nextOffset - offset

            offset = nextOffset + 45
        }

        this.prepare()
        this._gfx.setLayer(this._page1, this._vid._w)
    
        offset = 10
        const frames = READ_BE_UINT16(p, offset)
        offset += 2

        for (let i = 0; i < frames && !this._stub._pi.quit && !this._interrupted; ++i) {
            const timestamp = this._stub.getTimeStamp()
    
            this._page1.fill(0xC0, 0, this._vid._layerSize)
    
            const shapeBg = READ_BE_UINT16(p, offset)
            offset += 2
            const count = READ_BE_UINT16(p, offset)
            offset += 2
    
            const paletteBuffer = new Uint16Array(Cutscene.kMaxPaletteSize)
            paletteBuffer.fill(0)
            Cutscene.readSetPalette(p, backgroundShapes[shapeBg].offset + backgroundShapes[shapeBg].size, paletteBuffer)
            let paletteLutSize = 16
    
            const paletteLut = new Uint8Array(Cutscene.kMaxPaletteSize)
            for (let j = 0; j < 16; ++j) {
                paletteLut[j] = 0xC0 + j
            }
    
            this.drawSetShape(p, backgroundShapes[shapeBg].offset, 0, 0, paletteLut)
            for (let j = 0; j < count; ++j) {
                const shapeFg = READ_BE_UINT16(p, offset)
                offset += 2
                const shapeX = READ_BE_UINT16(p,offset) << 16 >> 16
                offset += 2
                const shapeY = READ_BE_UINT16(p, offset) << 16 >> 16
                offset += 2
    
                const tempPalette:Uint16Array = new Uint16Array(16)
                Cutscene.readSetPalette(p, foregroundShapes[shapeFg].offset + foregroundShapes[shapeFg].size, tempPalette)
                for (let k = 0; k < 16; ++k) {
                    let found = false
                    for (let l = 0; l < paletteLutSize; ++l) {
                        if (tempPalette[k] === paletteBuffer[l]) {
                            found = true
                            paletteLut[k] = 0xC0 + l
                            break
                        }
                    }
                    if (!found) {
                        if (paletteLutSize >= Cutscene.kMaxPaletteSize) {
                            throw(`Assertion failed: ${paletteLutSize} < ${Cutscene.kMaxPaletteSize}`)
                        }
                        paletteLut[k] = 0xC0 + paletteLutSize
                        paletteBuffer[paletteLutSize++] = tempPalette[k]
                    }
                }
                this.drawSetShape(p, foregroundShapes[shapeFg].offset, shapeX, shapeY, paletteLut)
            }
    
            for (let j = 0; j < paletteLutSize; ++j) {
                const c:Color = Video.AMIGA_convertColor(paletteBuffer[j])
                this._stub.setPaletteEntry(0xC0 + j, c)
            }
    
            this._stub.copyRect(0, 0, this._vid._w, this._vid._h, this._page1, this._vid._w)
            await this._stub.updateScreen(0)
            const diff = 6 * TIMER_SLICE - (this._stub.getTimeStamp() - timestamp)
            await this._stub.sleep((diff < 16) ? 16 : diff)
            await this._stub.processEvents()

            if (this._stub._pi.backspace) {
                this._stub._pi.backspace = false
                this._interrupted = true
            }
        }
    }
}

export { Cutscene, OpcodeStub }
