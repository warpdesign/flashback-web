import { g_options } from "./config"
import type { DecodeBuffer } from "./decode_mac"
import { Buffer, Color, Language, READ_BE_UINT16, READ_BE_UINT32, READ_LE_UINT16, READ_LE_UINT32, ResourceType, WidescreenMode } from "./intern"
import { kScratchBufferSize, Resource } from "./resource"
import { _conradPal1, _conradPal2, _font8Jp, _palSlot0xF, _textPal } from "./staticres"
import { SystemStub } from "./systemstub_web"
import { bytekiller_unpack } from "./unpack"
import { dump } from "./util"

type drawCharFunc = (p1: Uint8Array, p2: number, p3: number, p4:number, p5: Uint8Array, p6: number, p7: number) => void

const SCREENBLOCK_W = 8
const SCREENBLOCK_H = 8

class Video {
    static _conradPal1: Uint8Array = _conradPal1
    static _conradPal2: Uint8Array = _conradPal2
    static _textPal: Uint8Array = _textPal
    static _palSlot0xF: Uint8Array = _palSlot0xF
    static _font8Jp: Uint8Array = _font8Jp
    static GAMESCREEN_W = 256
    static GAMESCREEN_H = 224
    static CHAR_W = 8
    static CHAR_H = 8

    _res: Resource
    _stub: SystemStub
    _widescreenMode: WidescreenMode

    _w: number
    _h: number
    _layerSize: number
    _layerScale: number
    _frontLayer: Uint8Array
    _backLayer: Uint8Array
    _tempLayer: Uint8Array
    _tempLayer2: Uint8Array
    _unkPalSlot1: number
    _unkPalSlot2: number    
    _mapPalSlot1: number
    _mapPalSlot2: number        
    _mapPalSlot3: number    
    _mapPalSlot4: number
    _charFrontColor: number
    _charTransparentColor: number
    _charShadowColor: number
    _screenBlocks: Uint8Array         
    _fullRefresh: boolean
    _shakeOffset: number
    _drawChar: drawCharFunc

    constructor(res: Resource, stub: SystemStub, widescreenMode: WidescreenMode) {
      this._res = res
      this._stub = stub
      this._widescreenMode = widescreenMode
      this._layerScale = (res._type === ResourceType.kResourceTypeMac) ? 2 : 1
      this._w = Video.GAMESCREEN_W * this._layerScale
      this._h = Video.GAMESCREEN_H * this._layerScale
      this._layerSize = this._w * this._h
      this._frontLayer = new Uint8Array(this._layerSize)
      this._backLayer = new Uint8Array(this._layerSize)
      this._tempLayer = new Uint8Array(this._layerSize)
      this._tempLayer2 = new Uint8Array(this._layerSize)
      this._screenBlocks = new Uint8Array((this._w / SCREENBLOCK_W) * (this._h / SCREENBLOCK_H))
      this._fullRefresh = true
      this._shakeOffset = 0
      this._charFrontColor = 0
      this._charTransparentColor = 0
      this._charShadowColor = 0
      this._drawChar = null

      switch(res._type) {
          case ResourceType.kResourceTypeAmiga:
              this._drawChar = (dst: Uint8Array, pitch: number, x: number, y: number, src: Uint8Array, color: number, chr: number) => this.AMIGA_drawStringChar(dst, pitch, x, y, src, color, chr)
              break

          case ResourceType.kResourceTypeDOS:
                this._drawChar = (dst: Uint8Array, pitch: number, x: number, y: number, src: Uint8Array, color: number, chr: number) => this.PC_drawStringChar(dst, pitch, x, y, src, color, chr)
                break

          case ResourceType.kResourceTypeMac:
            this._drawChar = (dst: Uint8Array, pitch: number, x: number, y: number, src: Uint8Array, color: number, chr: number) => this.MAC_drawStringChar(dst, pitch, x, y, src, color, chr)
            break
      }
    }

    drawStringLen(str: string, len: number, x: number, y: number, color: number) {
        const fnt = (this._res._lang === Language.LANG_JP) ? _font8Jp : this._res._fnt
        for (let i = 0; i < len; ++i) {
            this._drawChar(this._frontLayer, this._w, x + i * Video.CHAR_W, y, fnt, color, str.charCodeAt(i))
        }
        this.markBlockAsDirty(x, y, len * Video.CHAR_W, Video.CHAR_H, this._layerScale)
    }

    PC_drawChar(c: number, y: number, x: number, forceDefaultFont: boolean) {
        const fnt = (this._res._lang === Language.LANG_JP && !forceDefaultFont) ? Video._font8Jp : this._res._fnt
        y *= Video.CHAR_W
        x *= Video.CHAR_H
        let src = (c - 32) * 32

        let dst = new Uint8Array(this._frontLayer.buffer, x + this._w * y)
        let index = 0

        for (let h = 0; h < Video.CHAR_H; ++h) {
            for (let i = 0; i < 4; ++i, ++src) {
                const c1 = fnt[src] >>> 4
                if (c1 !== 0) {
                    if (c1 !== 2) {
                        dst[0 + index] = this._charFrontColor
                    } else {
                        dst[0 + index] = this._charShadowColor
                    }
                } else if (this._charTransparentColor !== 0xFF) {
                    dst[0 + index] = this._charTransparentColor
                }

                index++
                const c2 = fnt[src] & 15
                if (c2 !== 0) {
                    if (c2 !== 2) {
                        dst[0 + index] = this._charFrontColor
                    } else {
                        dst[0 + index] = this._charShadowColor
                    }
                } else if (this._charTransparentColor !== 0xFF) {
                    dst[0 + index] = this._charTransparentColor
                }
                index++
            }
            index += this._w - Video.CHAR_W
        }
    }

    static _MAC_fontFrontColor: number
    static _MAC_fontShadowColor: number

    static AMIGA_convertColor(color: number, bgr: boolean = false) {
        let r = (color & 0xF00) >> 8
        const g = (color & 0xF0)  >> 4
        let b =  color & 0xF
        if (bgr) {
            const tmp = r
            r = b
            b = tmp
        }
        return {
            r: (r << 4) | r,
            g: (g << 4) | g,
            b: (b << 4) | b,
        }
    }

    static PC_decodeMapPlane(sz: number, src: Uint8Array, dst: Uint8Array) {
        const end = sz
        let index = 0
        while (index < end) {
            let code = src[index++] << 8 >> 8
            if (code < 0) {
                const len = 1 - code
                dst.fill(src[index++], 0, len)
                dst = dst.subarray(len)
            } else {
                ++code
                dst.set(src.subarray(0, code))
                index += code
                dst = dst.subarray(code)
            }
        }
    }

    static AMIGA_planar_mask(dst: Uint8Array, x0: number, y0: number, w: number, h: number, src: Uint8Array, mask: Uint8Array, size: number) {
        let dstIndex = y0 * 256 + x0
        let srcIndex = 0
        let maskIndex = 0
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w * 2; ++x) {
                for (let i = 0; i < 8; ++i) {
                    const c_mask = 1 << (7 - i)
                    let color = 0
                    for (let j = 0; j < 4; ++j) {
                        if (mask[j * size] & c_mask) {
                            color |= 1 << j
                        }
                    }
                    if (src[srcIndex] & c_mask) {
                        const px = x0 + 8 * x + i
                        const py = y0 + y
                        if (px >= 0 && px < 256 && py >= 0 && py < 224) {
                            dst[dstIndex + 8 * x + i] = color
                        }
                    }
                }
                srcIndex++
                maskIndex++
            }
            dstIndex += 256
        }
    }

    static AMIGA_decodeRle(dst: Uint8Array, src: Uint8Array) {
        const size = READ_BE_UINT16(src) & 0x7FFF
        let dstIndex = 0
        src = src.subarray(2)
        for (let i = 0; i < size; ) {
            let code = src[i++]
            if ((code & 0x80) === 0) {
                ++code
                if (i + code > size) {
                    code = size - i
                }
                dst.set(src.subarray(i, i + code), dstIndex)
                i += code
            } else {
                code = 1 - (code << 24 >> 24)
                dst.fill(src[i], dstIndex, dstIndex + code)
                ++i
            }
            dstIndex += code
        }
    }

    static PC_drawTileMask(dst: Uint8Array, x0: number, y0: number, w: number, h: number, m: Uint8Array, p: Uint8Array, size: number) {
        if (size !== (w * 2 * h)) {
            throw(`Assertion failed: ${size} === ${(w * 2 * h)}`)
        }
        let mIndex = 0
        let pIndex = 0
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                const bits = READ_BE_UINT16(m, mIndex);
                mIndex += 2
                for (let bit = 0; bit < 8; ++bit) {
                    const j = y0 + y
                    const i = x0 + 2 * (x * 8 + bit)
                    if (i >= 0 && i < Video.GAMESCREEN_W && j >= 0 && j < Video.GAMESCREEN_H) {
                        const color = p[pIndex]
                        if (bits & (1 << (15 - (bit * 2)))) {
                            dst[j * Video.GAMESCREEN_W + i] = color >> 4
                        }
                        if (bits & (1 << (15 - (bit * 2 + 1)))) {
                            dst[j * Video.GAMESCREEN_W + i + 1] = color & 15;
                        }
                    }
                    ++pIndex
                }
            }
        }
    }

    static decodeSgd(dst: Uint8Array, src: Uint8Array, data: Uint8Array, isAmiga: boolean) {
        let num = -1
        let index = 0        
        const buf = new Uint8Array(256 * 32)
        let count = READ_BE_UINT16(src) - 1
        index += 2
        let drawn = 0
        do {
            let d2 = READ_BE_UINT16(src, index)
            index += 2
            const d0 = READ_BE_UINT16(src, index) << 16 >> 16
            index += 2
            const d1 = READ_BE_UINT16(src, index) << 16 >> 16
            index += 2

            if (d2 != 0xFFFF) {
                d2 &= ~(1 << 15)
                const offset = READ_BE_UINT32(data, d2 * 4) << 32 >> 32
                if (offset < 0) {
                    const ptr = new Uint8Array(data.buffer, data.byteOffset - offset)
                    let ptrIndex = 0
                    const size = READ_BE_UINT16(ptr, ptrIndex) //  << 16 >> 16
                    ptrIndex += 2
                    if (num !== d2) {
                        num = d2
                        if (size > buf.byteLength) {
                            throw(`Assertion failed: ${size} <= ${buf.byteLength}`)
                        }
                        buf.set(ptr.subarray(ptrIndex, size + ptrIndex))
                    }
                } else {
                    if (num !== d2) {
                        num = d2
                        const size = READ_BE_UINT16(data,  offset) & 0x7FFF
                        if (size > buf.byteLength) {
                            throw(`Assertion failed: ${size} <= ${buf.byteLength}`)
                        }
                        const test = data.subarray(offset)
                        Video.AMIGA_decodeRle(buf, data.subarray(offset))
                    }
                }
            }
            const w = (buf[0] + 1) >> 1
            const h = buf[1] + 1
            const planarSize = READ_BE_UINT16(buf, 2)
            if (isAmiga) {
                Video.AMIGA_planar_mask(dst, d0, d1, w, h, buf.subarray(4), buf.subarray(4 + planarSize), planarSize)
            } else {
                Video.PC_drawTileMask(dst, d0, d1, w, h, buf.subarray(4), buf.subarray(4 + planarSize), planarSize)
            }
        } while (--count >= 0)
    }

    static AMIGA_mirrorTileY(a2: Uint8Array) {
        let buf = new Uint8Array(32)
    
        let index = 24
        for (let j = 0; j < 4; ++j) {
            for (let i = 0; i < 8; ++i) {
                buf[31 - j * 8 - i] = a2[index++]
            }
            index -= 16
        }
        return buf
    }
    
    static AMIGA_mirrorTileX(a2: Uint8Array) {
        let buf = new Uint8Array(32)
    
        for (let i = 0; i < 32; ++i) {
            let mask = 0;
            for (let bit = 0; bit < 8; ++bit) {
                if (a2[i] & (1 << bit)) {
                    mask |= 1 << (7 - bit)
                }
            }
            buf[i] = mask
        }
        return buf
    }

    static AMIGA_drawTile(dst: Uint8Array, pitch: number, src: Uint8Array, pal: number, xflip: boolean, yflip: boolean, colorKey: number) {
        if (yflip) {
            src = Video.AMIGA_mirrorTileY(src)
        }
        if (xflip) {
            src = Video.AMIGA_mirrorTileX(src)
        }
        let srcIndex = 0
        let dstIndex = 0
        for (let y = 0; y < 8; ++y) {
            for (let i = 0; i < 8; ++i) {
                const mask = 1 << (7 - i)
                let color = 0
                for (let bit = 0; bit < 4; ++bit) {
                    if (src[srcIndex + 8 * bit] & mask) {
                        color |= 1 << bit
                    }
                }
                if (color !== colorKey) {
                    dst[dstIndex + i] = pal + color
                }
            }
            ++srcIndex
            dstIndex += pitch
        }
    }

    static PC_drawTile(dst: Uint8Array, src: Uint8Array, mask: number, xflip: boolean, yflip: boolean, colorKey: number) {
        let pitch = Video.GAMESCREEN_W
        let dstIndex = 0
        let srcIndex = 0
        if (yflip) {
            dstIndex += 7 * pitch
            pitch = -pitch
        }
        let inc = 1
        if (xflip) {
            dstIndex += 7
            inc = -inc
        }
        for (let y = 0; y < 8; ++y) {
            for (let i = 0; i < 8; i += 2) {
                let color = src[srcIndex] >> 4
                if (color !== colorKey) {
                    dst[dstIndex + inc * i] = mask | color
                }
                color = src[srcIndex] & 15
                if (color !== colorKey) {
                    dst[dstIndex + inc * (i + 1)] = mask | color
                }
                ++srcIndex
            }
            dstIndex += pitch
        }
    }

    static decodeLevHelper(dst: Uint8Array, src: Uint8Array, offset10: number, offset12: number, a5: Uint8Array, sgdBuf: boolean, isPC: boolean) {
        if (offset10 !== 0) {
            let a0 = offset10
            for (let y = 0; y < 224; y += 8) {
                for (let x = 0; x < 256; x += 8) {
                    const d3 = isPC ? READ_LE_UINT16(src, a0) : READ_BE_UINT16(src, a0)
                    a0 += 2
                    const d0 = d3 & 0x7FF
                    if (d0 !== 0) {
                        const a2 = a5.subarray(d0 * 32)
                        const yflip = (d3 & (1 << 12)) !== 0
                        const xflip = (d3 & (1 << 11)) !== 0
                        let mask = 0;
                        if ((d3 & 0x8000) !== 0) {
                            mask = 0x80 + ((d3 >> 6) & 0x10)
                        }
                        if (isPC) {
                            Video.PC_drawTile(dst.subarray(y * 256 + x), a2, mask, xflip, yflip, -1)
                        } else {
                            Video.AMIGA_drawTile(dst.subarray(y * 256 + x), 256, a2, mask, xflip, yflip, -1)
                        }
                    }
                }
            }
        }
        if (offset12 !== 0) {
            let a0 = offset12
            for (let y = 0; y < 224; y += 8) {
                for (let x = 0; x < 256; x += 8) {
                    const d3 = isPC ? READ_LE_UINT16(src, a0) : READ_BE_UINT16(src, a0)
                    a0 += 2
                    let d0 = d3 & 0x7FF
                    if (d0 !== 0 && sgdBuf) {
                        d0 -= 896
                    }
                    if (d0 !== 0) {
                        const a2 = a5.subarray(d0 * 32)
                        const yflip = (d3 & (1 << 12)) !== 0
                        const xflip = (d3 & (1 << 11)) !== 0
                        let mask = 0
                        if ((d3 & 0x6000) !== 0 && sgdBuf) {
                            mask = 0x10
                        } else if ((d3 & 0x8000) !== 0) {
                            mask = 0x80 + ((d3 >> 6) & 0x10)
                        }

                        if (isPC) {
                            Video.PC_drawTile(dst.subarray(y * 256 + x), a2, mask, xflip, yflip, 0)
                        } else {
                            Video.AMIGA_drawTile(dst.subarray(y * 256 + x), 256, a2, mask, xflip, yflip, 0)
                        }
                    }
                }
            }
        }
    }

    MAC_drawSprite(x: number, y: number, data: Uint8Array, frame: number, xflip: boolean, eraseBackground: boolean) {
        // TODO
        debugger
    }

    fillRect(x: number, y: number, w: number, h: number, color: number) {
        const p = this._frontLayer
        let index = y * this._layerScale * this._w + x * this._layerScale;
        for (let j = 0; j < h * this._layerScale; ++j) {
            p.fill(color, index, index + w * this._layerScale)
            index += this._w
        }
    }

    drawString(str: string, x: number, y: number, col: number): string {
        const fnt = (this._res._lang === Language.LANG_JP) ? _font8Jp : this._res._fnt
        let len = 0
        let index = 0

        while (1) {
            const c = str.charCodeAt(index++)
            if (c === 0 || c === 0xB || c === 0xA || isNaN(c)) {
                break
            }
            this._drawChar(this._frontLayer, this._w, x + len * Video.CHAR_W, y, fnt, col, c)
            ++len
        }
        this.markBlockAsDirty(x, y, len * Video.CHAR_W, Video.CHAR_H, this._layerScale)

        return str
    }

    MAC_drawStringChar(dst: Uint8Array, pitch: number, x: number, y: number, src: Uint8Array, color: number, chr: number) {
        const buf:DecodeBuffer = {
            ptr: dst,
            w: this._w,
            pitch: this._w,
            h: this._h,
            x: x * this._layerScale,
            y: y * this._layerScale,
            setPixel: this.MAC_setPixel,
            xflip: false,
            dataPtr: null,
        }

        Video._MAC_fontFrontColor = color
        Video._MAC_fontShadowColor = this._charShadowColor
        if (chr < 32) {
            throw(`assertion failed: ${chr} >= 32`)
        }
        this._res.MAC_decodeImageData(this._res._fnt, chr - 32, buf)
    }

    MAC_setPixel(buf: DecodeBuffer, x: number, y: number, color: number) {
        const offset = y * buf.pitch + x
        buf.ptr[offset] = color
    }

    PC_decodeLev(level: number, room: number) {
        const tmp = this._res._mbk
        this._res._mbk = this._res._bnq
        this._res.clearBankData()
        this.AMIGA_decodeLev(level, room)
        this._res._mbk = tmp
        this._res.clearBankData()
    }

    MAC_decodeMap(level: number, room: number) {
        // TODO
        debugger
    }

    PC_decodeMap(level: number, room: number) {
        if (!this._res._map) {
            if (!this._res._lev) {
                throw(`Assertion failed: ${this._res._lev}`)
            }
            this.PC_decodeLev(level, room)
            return
        }

        if (room >= 0x40) {
            throw(`Assertion failed: ${room} < 0x40`)
        }
        let off = READ_LE_UINT32(this._res._map, room * 6) << 32 >> 32
        if (off === 0) {
            throw(`Invalid room ${room}`)
        }
        let packed = true
        if (off < 0) {
            off = -off
            packed = false
        }
        const map = this._res._map
        let p = off
        this._mapPalSlot1 = map[p++]
        this._mapPalSlot2 = map[p++]
        this._mapPalSlot3 = map[p++]
        this._mapPalSlot4 = map[p++]
        if (level === 4 && room === 60) {
            // workaround for wrong palette colors (fire)
            this._mapPalSlot4 = 5
        }
        const kPlaneSize = (256 * 224 / 4) >> 0
        if (packed) {
            for (let i = 0; i < 4; ++i) {
                const sz = READ_LE_UINT16(map, p)
                p += 2
                Video.PC_decodeMapPlane(sz, map.subarray(p), this._res._scratchBuffer)
                p += sz
                this._frontLayer.set(this._res._scratchBuffer.subarray(0, kPlaneSize), i * kPlaneSize)
            }
        } else {
            for (let i = 0; i < 4; ++i) {
                for (let y = 0; y < 224; ++y) {
                    for (let x = 0; x < 64; ++x) {
                        this._frontLayer[i + x * 4 + 256 * y] = map[p + kPlaneSize * i + x + 64 * y]
                    }
                }
            }
        }
        this._backLayer.set(this._frontLayer.subarray(0, this._layerSize))
        this.PC_setLevelPalettes()
    }

    PC_setLevelPalettes() {
        if (this._unkPalSlot2 === 0) {
            this._unkPalSlot2 = this._mapPalSlot3
        }
        if (this._unkPalSlot1 === 0) {
            this._unkPalSlot1 = this._mapPalSlot3
        }
        // background
        this.setPaletteSlotBE(0x0, this._mapPalSlot1)
        // objects
        this.setPaletteSlotBE(0x1, this._mapPalSlot2)
        this.setPaletteSlotBE(0x2, this._mapPalSlot3)
        this.setPaletteSlotBE(0x3, this._mapPalSlot4)
        // conrad
        if (this._unkPalSlot1 === this._mapPalSlot3) {
            this.setPaletteSlotLE(4, Video._conradPal1)
        } else {
            this.setPaletteSlotLE(4, Video._conradPal2)
        }
        // slot 5 is monster palette
        // foreground
        this.setPaletteSlotBE(0x8, this._mapPalSlot1)
        this.setPaletteSlotBE(0x9, this._mapPalSlot2)
        // inventory
        this.setPaletteSlotBE(0xA, this._unkPalSlot2)
        this.setPaletteSlotBE(0xB, this._mapPalSlot4)
        // slots 0xC and 0xD are cutscene palettes
        this.setTextPalette()
    }

    AMIGA_decodeLev(level: number, room: number) {
        const tmp = this._res._scratchBuffer
        const offset = READ_BE_UINT32(this._res._lev, room * 4)
        if (!bytekiller_unpack(tmp, kScratchBufferSize, this._res._lev, offset)) {
            console.warn(`Bad CRC for level ${level} room ${room}`)
            return
        }

        let offset10 = READ_BE_UINT16(tmp, 10)
        const offset12 = READ_BE_UINT16(tmp, 12)
        const offset14 = READ_BE_UINT16(tmp, 14)
        const kTempMbkSize = 1024
        const buf = new Uint8Array(kTempMbkSize * 32)
        if (!buf) {
            throw("Unable to allocate mbk temporary buffer")
        }
        let sz = 0
        for (let i = 0; i < 32; ++i) {
            buf[i] = 0
        }
        sz += 32
        let a1 = offset14
        for (let loop = true; loop;) {
            let d0 = READ_BE_UINT16(tmp, a1)
            a1 += 2
            if (d0 & 0x8000) {
                d0 &= ~0x8000
                loop = false
            }
            const d1 = this._res.getBankDataSize(d0)
            let a6 = this._res.findBankData(d0)
            if (!a6) {
                a6 = this._res.loadBankData(d0)
            }
            const d3 = tmp[a1++]
            if (d3 === 255) {
                if (sz + d1 > kTempMbkSize * 32) {
                    throw(`Assertion failed: ${sz + d1} <= ${kTempMbkSize * 32}`)
                }
                buf.set(a6.subarray(0, d1), sz)
                sz += d1                
            } else {
                for (let i = 0; i < d3 + 1; ++i) {
                    const d4 = tmp[a1++]
                    if (sz + 32 > kTempMbkSize * 32) {
                        throw(`Assertion failed: ${sz + 32} <= ${kTempMbkSize * 32}`)
                    }
                    buf.set(a6.subarray(d4 * 32, (d4 * 32) + 32), sz)
                    sz += 32
                }
            }
        }

        this._frontLayer.fill(0)
        if (tmp[1] !== 0) {
            if (!this._res._sgd) {
                throw(`Assertion error: ${this._res._sgd}`)
            }
            Video.decodeSgd(this._frontLayer, new Uint8Array(tmp.buffer, tmp.byteOffset + offset10), this._res._sgd, this._res.isAmiga())
            offset10 = 0
        }

        Video.decodeLevHelper(this._frontLayer, tmp, offset10, offset12, buf, tmp[1] !== 0, this._res.isDOS())
        this._backLayer.set(this._frontLayer.subarray(0, this._layerSize))
        this._mapPalSlot1 = READ_BE_UINT16(tmp, 2)
        this._mapPalSlot2 = READ_BE_UINT16(tmp, 4)
        this._mapPalSlot3 = READ_BE_UINT16(tmp, 6)
        this._mapPalSlot4 = READ_BE_UINT16(tmp, 8)

        if (this._res.isDOS()) {
            this.PC_setLevelPalettes()
            if (level === 0) { // tiles with color slot 0x9
                this.setPaletteSlotBE(0x9, this._mapPalSlot1)
            }
            return
        }
        // background
        this.setPaletteSlotBE(0x0, this._mapPalSlot1)
        // objects
        this.setPaletteSlotBE(0x1, (level === 0) ? this._mapPalSlot3 : this._mapPalSlot2)
        this.setPaletteSlotBE(0x2, this._mapPalSlot3)
        this.setPaletteSlotBE(0x3, this._mapPalSlot3)
        // conrad
        this.setPaletteSlotBE(0x4, this._mapPalSlot3)
        // foreground
        this.setPaletteSlotBE(0x8, this._mapPalSlot1)
        this.setPaletteSlotBE(0x9, (level === 0) ? this._mapPalSlot1 : this._mapPalSlot3)
        // inventory
        this.setPaletteSlotBE(0xA, this._mapPalSlot3)
    }

    AMIGA_decodeSpc(src: Uint8Array, w: number, h: number, dst: Uint8Array) {
        // TODO
        debugger
        // switch (w) {
        // case 8:
        //     AMIGA_planar8(dst, w, h, src);
        //     break;
        // case 16:
        // case 32:
        //     AMIGA_planar16(dst, w / 16, h, 4, src);
        //     break;
        // case 24:
        //     AMIGA_planar24(dst, w, h, src);
        //     break;
        // default:
        //     warning("AMIGA_decodeSpc w=%d unimplemented", w);
        //     break;
        // }
    }

    AMIGA_decodeSpm(src: Uint8Array, dst: Uint8Array) {
        // TODO
        debugger
        // uint8_t buf[256 * 32];
        // const int size = READ_BE_UINT16(src + 3) & 0x7FFF;
        // assert(size <= (int)sizeof(buf));
        // AMIGA_decodeRle(buf, src + 3);
        // const int w = (src[2] >> 7) + 1;
        // const int h = src[2] & 0x7F;
        // AMIGA_planar16(dst, w, h, 3, buf);
    }

    static AMIGA_planar16 = (dst: Uint8Array, w: number, h: number, depth: number, src: Uint8Array) => {
        const pitch = w * 16
        const planarSize = w * 2 * h
        let src_offset = 0
        let dst_offset = 0
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                for (let i =0; i < 16; ++i) {
                    let color = 0
                    const mask = 1 << (15 - i)
                    for (let bit = 0; bit < depth; ++bit) {
                        if (READ_BE_UINT16(new Uint8Array(src, src_offset + bit * planarSize)) & mask) {
                            color |= 1 << bit
                        }
                    }
                    dst[dst_offset + x * 16 + i] = color
                }
                src_offset += 2
            }
            dst_offset += pitch
        }
    }
    
    AMIGA_decodeIcn(src: Uint8Array, num: number, dst: Uint8Array) {
        let src_offset = 0
        for (let i = 0; i < num; ++i) {
            const h = 1 + src[src_offset++]
            const w = 1 + src[src_offset++]
            const size = w * h * 8
            src_offset += 4 + size
        }
        const h = 1 + src[src_offset++]
        const w = 1 + src[src_offset++]
        Video.AMIGA_planar16(dst, w, h, 4, new Uint8Array(src.buffer, src_offset + 4))
    }

    AMIGA_drawStringChar(dst: Uint8Array, pitch: number, x: number, y: number, src: Uint8Array, color: number, chr: number) {
        let dst_offset = y * pitch + x
        if (chr < 32) {
            throw (`assert failed: ${chr} >= 32`)
        }
        this.AMIGA_decodeIcn(src, chr - 32, this._res._scratchBuffer)
        let src_offset = 0
        for (let y = 0; y < 8; ++y) {
            for (let x = 0; x < 8; ++x) {
                if (this._res._scratchBuffer[x + src_offset] !== 0) {
                    dst[dst_offset + x] = color
                }
            }
            src_offset += 16
            dst_offset += pitch
        }
    }

    PC_drawStringChar(dst: Uint8Array, pitch: number, x: number, y: number, src: Uint8Array, color: number, chr: number) {
        let dst_offset = y * pitch + x
        if (chr < 32) {
            throw (`assert failed: ${chr} < 32`)
        }
        let src_offset = (chr - 32) * 8 * 4   
        for (let y = 0; y < 8; ++y) {
            for (let x = 0; x < 4; ++x) {
                const c1 = src[src_offset + x] >>> 4
                if (c1 !== 0) {
                    dst[dst_offset] = (c1 === 15) ? color : (0xE0 + c1)
                }
                dst_offset++
                const c2 = src[src_offset + x] & 15
                if (c2 !== 0) {
                    dst[dst_offset] = (c2 === 15) ? color: (0xE0 + c2)
                }
                dst_offset++
            }
            src_offset += 4
            dst_offset += pitch - Video.CHAR_W
        }
    }

    fullRefresh() {
        this._fullRefresh = true
        this._screenBlocks.fill(0, (this._w / SCREENBLOCK_W) * (this._h / SCREENBLOCK_H))
    }

    async fadeOut() {
        if (g_options.fade_out_palette) {
            await this.fadeOutPalette()
        } else {
            this._stub.fadeScreen()
        }
    }

    async fadeOutPalette() {
        for (let step = 16; step >= 0; --step) {
            for (let c = 0; c < 256; ++c) {
                const col:Color = {
                    r: 0,
                    g: 0,
                    b: 0,
                }
                this._stub.getPaletteEntry(c, col)
                col.r = col.r * step >> 4
                col.g = col.g * step >> 4
                col.b = col.b * step >> 4
                this._stub.setPaletteEntry(c, col)
            }
            this.fullRefresh()
            await this.updateScreen()
            await this._stub.sleep(50)
        }

    }
    setPaletteColorBE(num: number, offset: number) {
        const color = READ_BE_UINT16(this._res._pal,  offset * 2)
        const c: Color = Video.AMIGA_convertColor(color, true)
        this._stub.setPaletteEntry(num, c)
    }
    
    setPaletteSlotLE(palSlot: number, palData: Uint8Array) {
        for (let i = 0; i < 16; ++i) {
            const color = READ_LE_UINT16(palData, i * 2)
            const c: Color = Video.AMIGA_convertColor(color)
            this._stub.setPaletteEntry(palSlot * 16 + i, c)
        }

        if (palSlot === 4 && g_options.use_white_tshirt) {
            const color12: Color = Video.AMIGA_convertColor(0x888)
            const color13: Color = Video.AMIGA_convertColor((palData === Video._conradPal2) ? 0x888 : 0xCCC)
            this._stub.setPaletteEntry(palSlot * 16 + 12, color12)
            this._stub.setPaletteEntry(palSlot * 16 + 13, color13)
        }
    }

    setPaletteSlotBE(palSlot: number, palNum: number) {
        let p = palNum * 32
        const pal = this._res._pal
        for (let i = 0; i < 16; ++i) {
            const color = READ_BE_UINT16(pal, p)
            p += 2
            const c: Color = this.AMIGA_convertColor(color, true)
            this._stub.setPaletteEntry(palSlot * 16 + i, c)
        }
    }

    AMIGA_convertColor(color: number, bgr: boolean) { // 4bits to 8bits
        let r = (color & 0xF00) >> 8;
        let g = (color & 0xF0)  >> 4
        let b =  color & 0xF
        if (bgr) {
            const tmp = r
            r = b
            b = tmp
        }
        const c: Color = {
            r: (r << 4) | r,
            g: (g << 4) | g,
            b: (b << 4) | b,
        }

        return c
    }

    setTextPalette() {
        this.setPaletteSlotLE(0xE, Video._textPal)
        if (this._res.isAmiga()) {
            const c = {
                r: 0xEE,
                g: 0xEE,
                b: 0
            }
            this._stub.setPaletteEntry(0xE7, c)
        }
    }
    
    setPalette0xF() {
        const p = Video._palSlot0xF
        let index = 0
        for (let i = 0; i < 16; ++i) {
            const c = {
                r: p[index++],
                g: p[index++],
                b: p[index++]
            }
            this._stub.setPaletteEntry(0xF0 + i, c)
        }
    }

    PC_decodeIcn(src:Uint8Array, num: number, dst: Uint8Array) {
        const offset = READ_LE_UINT16(src, num * 2)
        const p = src.subarray(offset + 2)
        let index = 0
        for (let i = 0; i < 16 * 16 / 2; ++i) {
            dst[index++] = p[i] >> 4
            dst[index++] = p[i] & 15
        }
    }
    
    PC_decodeSpc(src: Uint8Array, w: number, h: number, dst: Uint8Array) {
        const size = w * h / 2
        let index = 0
        for (let i = 0; i < size; ++i) {
            dst[index++] = src[i] >> 4
            dst[index++] = src[i] & 15
        }
    }
    
    PC_decodeSpm(dataPtr: Uint8Array, dst: Uint8Array) {
        const len = 2 * READ_BE_UINT16(dataPtr)
        dataPtr = dataPtr.subarray(2)
        let index = 0
        const dst2 = dst.subarray(1024)
        for (let i = 0; i < len; ++i) {
            dst2[index++] = dataPtr[i] >> 4
            dst2[index++] = dataPtr[i] & 15
        }
        const src = dst.subarray(1024)
        const end = src.subarray(len)
        let dstIndex = 0
        let srcIndex = 0
        do {
            const code = src[srcIndex++]
            if (code === 0xF) {
                let color = src[srcIndex++]
                let count = src[srcIndex++]
                if (color === 0xF) {
                    count = (count << 4) | src[srcIndex++]
                    color = src[srcIndex++]
                }
                count += 4
                dst.fill(color, dstIndex, dstIndex + count)
                dstIndex += count
            } else {
                dst[dstIndex++] = code
            }
        } while (srcIndex < len)
    }

    drawSpriteSub1(src: Uint8Array, dst: Uint8Array, pitch: number, h: number, w: number, colMask: number) {
        let srcIndex = 0
        let dstIndex = 0
        while (h--) {
            for (let i = 0; i < w; ++i) {
                if (src[srcIndex + i] !== 0) {
                    dst[dstIndex + i] = src[srcIndex + i] | colMask
                }
            }
            srcIndex += pitch
            dstIndex += 256
        }
    }
    
    drawSpriteSub2(src: Uint8Array, dst: Uint8Array, pitch: number, h: number, w: number, colMask: number) {
        let srcIndex = src.byteOffset
        src = new Uint8Array(src.buffer)
        let dstIndex = 0
        while (h--) {
            for (let i = 0; i < w; ++i) {
                if (src[-i + srcIndex] !== 0) {
                    dst[dstIndex + i] = src[-i + srcIndex] | colMask
                }
            }
            srcIndex += pitch
            dstIndex += 256
        }
    }
    
    drawSpriteSub3(src: Uint8Array, dst: Uint8Array, pitch: number, h: number, w: number, colMask: number) {
        let srcIndex = 0
        let dstIndex = 0
        while (h--) {
            for (let i = 0; i < w; ++i) {
                if (src[srcIndex + i] != 0 && !(dst[dstIndex + i] & 0x80)) {
                    dst[dstIndex + i] = src[srcIndex + i] | colMask
                }
            }
            srcIndex += pitch
            dstIndex += 256
        }
    }
    
    drawSpriteSub4(src: Uint8Array, dst: Uint8Array, pitch: number, h: number, w: number, colMask: number) {
        let srcIndex = src.byteOffset
        let dstIndex = 0
        src = new Uint8Array(src.buffer)
        while (h--) {
            for (let i = 0; i < w; ++i) {
                if (src[-i + srcIndex] != 0 && !(dst[i + dstIndex] & 0x80)) {
                    dst[i + dstIndex] = src[-i + srcIndex] | colMask
                }
            }
            srcIndex += pitch
            dstIndex += 256
        }
    }
    
    drawSpriteSub5(src: Uint8Array, dst: Uint8Array, pitch: number, h: number, w: number, colMask: number) {
        let srcIndex = 0
        let dstIndex = 0
        while (h--) {
            for (let i = 0; i < w; ++i) {
                if (src[i * pitch + srcIndex] != 0 && !(dst[i + dstIndex] & 0x80)) {
                    dst[i + dstIndex] = src[i * pitch + srcIndex] | colMask
                }
            }
            ++srcIndex
            dstIndex += 256
        }
    }
    
    drawSpriteSub6(src: Uint8Array, dst: Uint8Array, pitch: number, h: number, w: number, colMask: number) {
        let srcIndex = src.byteOffset
        let dstIndex = 0
        src = new Uint8Array(src.buffer)
        while (h--) {
            for (let i = 0; i < w; ++i) {
                if (src[-i * pitch + srcIndex] != 0 && !(dst[i + dstIndex] & 0x80)) {
                    dst[i + dstIndex] = src[-i * pitch + srcIndex] | colMask;
                }
            }
            ++srcIndex
            dstIndex += 256
        }
    }

    markBlockAsDirty(x: number, y: number, w: number, h: number, scale: number) {
        let bx1 = (scale * x / SCREENBLOCK_W) >> 0
        let by1 = (scale * y / SCREENBLOCK_H) >> 0
        let bx2 = (scale * (x + w - 1) / SCREENBLOCK_W) >> 0
        let by2 = (scale * (y + h - 1) / SCREENBLOCK_H) >> 0
        if (bx1 < 0) {
            bx1 = 0
        }
        if (bx2 > ((this._w / SCREENBLOCK_W) >> 0) - 1) {
            bx2 = (((this._w / SCREENBLOCK_W) >> 0) - 1)
        }
        if (by1 < 0) {
            by1 = 0
        }
        if (by2 > ((this._h / SCREENBLOCK_H) >> 0) - 1) {
            by2 = (((this._h / SCREENBLOCK_H) >> 0) - 1) >> 0
        }
        const start = by1
        for (; by1 <= by2; ++by1) {
            for (let i = bx1; i <= bx2; ++i) {
                this._screenBlocks[by1 * ((this._w / SCREENBLOCK_W) >> 0) + i] = 2
            }
        }
    }

    async updateScreen(dbg = false) {
        if (this._fullRefresh) {
            this._stub.copyRect(0, 0, this._w, this._h, this._frontLayer, this._w)
            await this._stub.updateScreen(this._shakeOffset)
            this._fullRefresh = false
        } else {
            let i, j
            let count = 0
            const p = this._screenBlocks
            let index = 0
            for (j = 0; j < this._h / SCREENBLOCK_H; ++j) {
                let nh = 0
                for (i = 0; i < this._w / SCREENBLOCK_W; ++i) {
                    if (p[i + index] !== 0) {
                        --p[i + index]
                        ++nh
                    } else if (nh !== 0) {
                        let x = (i - nh) * SCREENBLOCK_W
                        this._stub.copyRect(x, j * SCREENBLOCK_H, nh * SCREENBLOCK_W, SCREENBLOCK_H, this._frontLayer, this._w)
                        nh = 0
                        ++count
                    }
                }
                if (nh !== 0) {
                    let x = (i - nh) * SCREENBLOCK_W
                    this._stub.copyRect(x, j * SCREENBLOCK_H, nh * SCREENBLOCK_W, SCREENBLOCK_H, this._frontLayer, this._w)
                    ++count
                }
                index += this._w / SCREENBLOCK_W
            }
            if (count !== 0) {
                await this._stub.updateScreen(this._shakeOffset)
            }
        }
        if (this._shakeOffset !== 0) {
            this._shakeOffset = 0
            this._fullRefresh = true
        }
    }

    updateWidescreen() {
        if (this._stub.hasWidescreen()) {
            if (this._widescreenMode === WidescreenMode.kWidescreenMirrorRoom) {
                this._stub.copyWidescreenMirror(this._w, this._h, this._backLayer)
            } else if (this._widescreenMode === WidescreenMode.kWidescreenBlur) {
                this._stub.copyWidescreenBlur(this._w, this._h, this._backLayer)
            } else {
                this._stub.clearWidescreen()
            }
        }
    }    
}

export { Video }
