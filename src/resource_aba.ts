import { File } from "./file"
import { FileSystem } from "./fs"
import { bytekiller_unpack } from "./unpack"

interface ResourceAbaEntry {
    name: string
    offset: number
    compressedSize: number
    size: number
}

class ResourceAba {
    static FILENAME = 'DEMO_UK.ABA'
    static TAG = 0x442E4D2E
    static compareAbaEntry = (a: ResourceAbaEntry, b: ResourceAbaEntry) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())

    _fs: FileSystem
    _f: File = new File()
    _entries: ResourceAbaEntry[]
    _entriesCount: number

    constructor(fs: FileSystem) {
        this._fs = fs
        this._entries = null
        this._entriesCount = 0
    }

    async readEntries() {
        const _f = this._f
        if (await _f.open(ResourceAba.FILENAME, 'rb', this._fs)) {
            this._entriesCount = _f.readUint16BE()
            this._entries = new Array(this._entriesCount)
            if (!this._entries.length) {
                throw `Failed to allocate ${this._entriesCount} entries`
            }
            const entrySize = _f.readUint16BE()
            if (entrySize !== 30) {
                throw `Assertion failed: ${entrySize} === 30`
            }
            let nextOffset = 0
            const _entries = this._entries
            for (let i = 0; i < this._entriesCount; ++i) {
                _entries[i] = {
                    name: _f.readString(14),
                    offset: _f.readUint32BE(),
                    compressedSize: _f.readUint32BE(),
                    size: _f.readUint32BE(),
                }
                const tag = _f.readUint32BE()
                if (tag !== ResourceAba.TAG) {
                    throw(`Assertion failed: ${tag} === ${ResourceAba.TAG}`)
                }
                if (i !== 0) {
                    if (nextOffset !== _entries[i].offset) {
                        throw(`Assertion failed: ${nextOffset} === ${_entries[i].offset}`)
                    }
                }
                nextOffset = _entries[i].offset + _entries[i].compressedSize
                _entries.sort(ResourceAba.compareAbaEntry)
            }
        }
    }

    findEntry(name: string): ResourceAbaEntry {
        return this._entries.find((entry: ResourceAbaEntry) => entry.name.toLowerCase() === name.toLowerCase()) || null
    }

    loadEntry(name: string) {
        const res = {
            dat: null as Uint8Array,
            size: 0,
        }

        const e:ResourceAbaEntry = this.findEntry(name)
        if (e) {
            res.size = e.size
            const tmp:Uint8Array = new Uint8Array(e.compressedSize)
            if (!tmp) {
                throw(`Failed to allocate ${e.compressedSize} bytes`)
                return res
            }
            this._f.seek(e.offset)
            this._f.read(tmp.buffer, e.compressedSize)
            if (e.compressedSize === e.size) {
                res.dat = tmp
            } else {
                res.dat = new Uint8Array(e.size)
                if (!res.dat) {
                    throw(`Failed to allocate ${e.size} bytes`)
                    return res
                }
                const ret = bytekiller_unpack(res.dat, e.size, tmp, e.compressedSize)
                if (!ret) {
                    throw(`Bad CRC for '${name}'`)
                }
            }
            return res
        }
    }
}

export { ResourceAba }
