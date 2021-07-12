import { FileSystem } from "./fs"

enum SEEK {
    END,
    SET,
    CUR
}

interface File_impl {
	_ioErr: boolean
	constructor: Function
	open: (path: string, mode: string) => Promise<boolean>
    close: () => void
	size: () => number
	seek: (off: number) => void
	read: (ptr: ArrayBuffer, len: number) => number
    readString: (len: number) => string
	write: (ptr: ArrayBuffer, len: number) => number
};

// Fake C-like FILE interface
// using fetch
export class FILE {
    _buf?: ArrayBuffer
    _len?: number
    _pos?: number
    constructor(buffer: ArrayBuffer) {
        this._buf = buffer
        this._len = this._buf.byteLength
        this._pos = 0
    }
    toString() {
        const decoder = new TextDecoder("utf-8")
        return decoder.decode(new Uint8Array(this._buf))
    }
    ftell() {
        return this._pos
    }
    fseek(offset: number, whence: SEEK) {
        switch(whence) {
            case SEEK.SET:
                if (offset >= 0) {
                    this._pos = offset
                }
                break

            case SEEK.END:
                if (this._len + offset > 0) {
                    this._pos = this._len + offset
                }
                break
            case SEEK.CUR:
                if (this._pos + offset > 0) {
                    this._pos += offset
                }
                break
        }
    }
    fread(ptr: ArrayBuffer, size: number, nmemb: number) {
        const req = size * nmemb
        const max = Math.min(req, this._len - this._pos)
        const buf = new DataView(this._buf)
        new Uint8Array(ptr, 0, ptr.byteLength).set(new Uint8Array(this._buf, this._pos, max))
        this._pos += max
        return max
    }
    static async fopen(path: string, mode: string):Promise<FILE> {
        try {
            const response = await fetch(path)
            const buffer = await response.arrayBuffer()
            return new FILE(buffer)
        } catch(e) {
            console.error(`FILE_impl::open could not open file ${path} (${mode})`)
            return undefined
        }
    }
}

// Fake C-like FILE implementation
export class StdioFile implements File_impl {
    _fp?: FILE
    _ioErr: boolean
    constructor() {
        this._fp = null
    }
    async open(path: string, mode: string) {
        this._ioErr = false
        try {
            this._fp = await FILE.fopen(path, mode)
            return true
        } catch(e) {
            return false
        }
    }
    close() {
        this._fp = null
    }
    size() {
        let sz = 0
        if (this._fp) {
            const fp = this._fp
            const pos = fp.ftell()
            fp.fseek(0, SEEK.END)
            sz = fp.ftell()
            fp.fseek(pos, SEEK.SET)
        }
        return sz
    }
    seek(off: number) {
        if (this._fp) {
            this._fp.fseek(off, SEEK.SET)
        }
    }
    read(ptr: ArrayBuffer, len: number): number {
        if (this._fp) {
            const r = this._fp.fread(ptr, 1, len)
            if (r !== len) {
                this._ioErr = true
            }
            return r
        }
        return 0
    }
    readString(len: number): string {
        if (this._fp) {
            const ptr = new Uint8Array(len)
            const r = this._fp.fread(ptr.buffer, 1, len)
            if (r!== len) {
                this._ioErr = true
            }
            const enc = new TextDecoder('utf-8')
            // ugly hack to stop the string when reaching C-like '\0'
            // which marks the end of a string 
            return enc.decode(ptr).split('\u0000')[0]
        }
        return ''
    }
    write(ptr: ArrayBuffer, len: number) {
        console.warn('File_impl::write Write is not supported')
        return 0
    }
}

export class MemoryBufferFile implements File_impl {
    _ioErr: boolean
    _ptr: ArrayBuffer
    _capacity: number
    _offset: number
    _len: number

    constructor(initialCapacity: number) {
        this._capacity = initialCapacity
        this._ptr = new ArrayBuffer(this._capacity)
        this._offset = this._len = 0
    }

    open(path: string, mode: string) {
        return Promise.resolve(false)
    }

    close() {

    }

    size() {
        return this._len
    }

    tell() {
        return this._offset
    }

    seek(offs: number) {
        this._offset = offs
    }

    read(ptr: ArrayBuffer, len: number) {
		let count = len
		if (this._offset + count > this._len) {
			count = this._len - this._offset;
			this._ioErr = true;
		}
		if (count !== 0) {
            new Uint8Array(ptr, 0, ptr.byteLength).set(new Uint8Array(this._ptr, this._offset, count))
			this._offset += count;
		}
		return count
    }

    readString() {
        debugger
        return ""
    }

    write(ptr: ArrayBuffer, len: number): number {
        let count = len
        while(this._offset + count > this._capacity) {
            const buffer = new ArrayBuffer(this._capacity)
            new Uint8Array(buffer).set(new Uint8Array(this._ptr))
            this._ptr = buffer
        }
        if (count !== 0) {
            new Uint8Array(this._ptr, this._offset, count).set(new Uint8Array(ptr, 0, count))
            this._offset += count
        }
        this._len = this._offset

        return count
    }
}

export class File {
    _impl: File_impl
    constructor() {
        this._impl = null
    }
    destructor() {
        if (this._impl) {
            this._impl.close()
            this._impl = null
        }
    }

    async open(filename: string, mode: string, directory: string): Promise<boolean>
    async open(filename: string, mode: string, fs: FileSystem): Promise<boolean>
    async open(filename: string, mode: string, fsOrDir: FileSystem|string): Promise<boolean>
    {
        if (this._impl) {
            this._impl.close()
            // call destructor?
            this._impl = null
        }
        if (typeof fsOrDir === 'string') {
            if (!this._impl) {
                this._impl = new StdioFile()
            }
            const path = `${fsOrDir}/${filename}`
            console.log(`Open file name '${filename}' mode '${mode}' path '${path}'`)
            return this._impl.open(path, mode)
        } else {
            if (mode[0] === 'z') {
                throw 'mode should not be "z"'
            }
            this._impl = new StdioFile()
            const path = (fsOrDir as FileSystem).findPath(filename)
            if (path) {
                console.log(`Open file name '${filename}' mode '${mode}' path '${path}'`)
                const ret = await this._impl.open(path, mode)
                return ret
            }
    
            return false
        }
    }

    openMemoryBuffer(initialCapacity: number) {
        if (this._impl) {
            this._impl.close()
            this._impl = null
        }
        this._impl = new MemoryBufferFile(initialCapacity)
    }

    close() {
        if (this._impl) {
            this._impl.close()
        }
    }

    ioErr(): boolean {
        return this._impl._ioErr
    }

    size() {
        return this._impl.size()
    }

    seek(off: number) {
        this._impl.seek(off)
    }

    read(ptr: ArrayBuffer, len: number): number {
        return this._impl.read(ptr, len)
    }

    readString(len: number): string {
        return this._impl.readString(len)
    }

    readByte() {
        const buff = new ArrayBuffer(1)
        this.read(buff, 1)
        return new Uint8Array(buff)[0]
    }

    readUint16LE(): number {
        const lo = this.readByte()
        const hi = this.readByte()
        return (hi << 8) | lo
    }

    readUint32LE(): number {
        const lo = this.readUint16LE()
        const hi = this.readUint16LE()
        return (hi << 16) | lo
    }    

    readUint16BE(): number {
        const hi = this.readByte()
        const lo = this.readByte()
        return (hi << 8) | lo
    }

    readUint32BE(): number {
        const hi = this.readUint16BE()
        const lo = this.readUint16BE()
        return (hi << 16) | lo
    }

    write(ptr: ArrayBuffer, len: number): number {
        return this._impl.write(ptr, len)
    }

    writeByte(b: number) {
        const buff = new ArrayBuffer(1)
        new Uint8Array(buff)[0] = b
        this.write(buff, 1)
    }

    writeUint16LE(n: number) {
        this.writeByte(n & 0xFF)
        this.writeByte(n >> 8)
    }

    writeUint32LE(n: number) {
        this.writeByte(n & 0xFFFF)
        this.writeByte(n >> 16)
    }

    writeUint16BE(n: number) {
        this.writeByte(n >> 8)
        this.writeByte(n & 0xFF)
    }

    writeUint32BE(n: number) {
        this.writeByte(n >> 16)
        this.writeByte(n & 0xFFFF)
    }

    dumpFile(filename: string, p: ArrayBuffer, size: number) {
        console.error('File::dumpFile NOT IMPLEMENTED!')
    }
}
