import { File } from "./file";
import { ARRAYSIZE, READ_BE_UINT16 } from "./intern";

interface DecodeBuffer {
    ptr: Uint8Array
    x: number
    y: number
    w: number
    h: number
    pitch: number
    xflip: boolean
    setPixel: (buf: DecodeBuffer, x: number, y: number, color: number) => void
    dataPtr: ArrayBuffer
}

const setPixel = (x: number, y: number, w: number, h: number, color: number, buf: DecodeBuffer) => {
    y += buf.y
    if (y >= 0 && y < buf.h) {
        if (buf.xflip) {
            x = w - 1 - x
        }
        x += buf.x
        if (x >= 0 && x < buf.w) {
            buf.setPixel(buf, x, y, color)
        }
    }
}

const decodeLzss = (f: File, decodedSize: number) => {
    decodedSize = f.readUint32LE()
    const dst = new Uint8Array(decodedSize)
    let count = 0
    while(count < decodedSize) {
        const code = f.readByte()
        for (let i = 0; i < 8 && count < decodedSize; ++i) {
            if ((code & (1 << i)) === 0) {
                dst[count++] = f.readByte()
            } else {
                let offset = f.readUint16BE()
                const len = (offset >> 12) + 3
                offset &= 0xFFF
                for (let j = 0; j < len; ++j) {
                    dst[count + j] = dst[count - offset - 1 + j]
                }
                count += len
            }
        }
    }
    if (count !== decodedSize) {
        throw(`assert failed: ${count} === ${decodedSize}`)
    }
    return dst
}

const decodeC103 = (src: Uint8Array, w: number, h: number, buf: DecodeBuffer) => {
    const kBits = 12
    const kMask = (1 << kBits) - 1
    let cursor = 0
    let bits = 1
    let count = 0
    let offset = 0
    let win: Uint8Array = new Uint8Array((1 << kBits))
    let src_offset = 0

    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            if (count === 0) {
                let carry = bits & 1
                bits >>= 1
                if (bits === 0) {
                    bits = src[src_offset++]

                    if (carry) {
                        bits |= 0x100
                    }
                    carry = bits & 1
                    bits >>= 1
            }
            if (!carry) {
                const color = src[src_offset++]
                win[cursor] = color
                ++cursor
                cursor &= kMask
                setPixel(x, y, w, h, color, buf)
                continue
            }
            offset = READ_BE_UINT16(src, src_offset)
            src_offset += 2
            count = 3 + (offset >> 12)
            offset &= kMask
            offset = (cursor - offset - 1) & kMask
        }

        const color = win[offset++]
        offset &= kMask
        win[cursor++] = color
        cursor &= kMask
        setPixel(x, y, w, h, color, buf)
        --count
    }
}
}

const decodeC211 = (src: Uint8Array, w: number, h: number, buf: DecodeBuffer) => {
    const stack: {
        ptr: Uint8Array,
        repeatCount: number
    }[] = new Array(512)

    let y = 0
    let x = 0
    let sp = 0
    let src_offset = 0

    while(1) {
        let code = src[src_offset++]
        if((code & 0x80) !== 0) {
            ++y
            x = 0
        }
        let count = code & 0x1F
        if (count === 0) {
            count = READ_BE_UINT16(src, src_offset)
            src_offset += 2
        }
        if ((code & 0x40) === 0) {
            if ((code & 0X20) === 0) {
                if (count === 1) {
                    if (sp <= 0) {
                        throw(`assertion failed: ${sp} > 0`)
                    }
                    --stack[sp -1].repeatCount
                    if (stack[sp -1].repeatCount >= 0) {
                        src = stack[sp - 1].ptr
                        src_offset = 0
                    } else {
                        --sp
                    }
                } else {
                    if (sp >= ARRAYSIZE(stack)) {
                        throw(`assertion failed: ${sp} < ${ARRAYSIZE(stack)}`)
                    }
                    stack[sp].ptr = src
                    stack[sp].repeatCount = count - 1
                    ++sp
                }
            } else {
                x += count
            }
        } else {
            if ((code & 0X20) === 0) {
                if (count === 1) {
                    return
                }
                const color = src[src_offset++]
                for (let i = 0; i < count; ++i) {
                    setPixel(x++, y, w, h, color, buf)
                }
            } else {
                for (let i = 0; i < count; ++i) {
                    setPixel(x++, y, w, h, src[src_offset++], buf)
                }
            }
        }
    }
}

export { DecodeBuffer, decodeC103, decodeC211 }
