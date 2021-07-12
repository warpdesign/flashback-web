import { File } from "./file"
import { FileSystem } from "./fs"

interface ResourceMacMap {
    typesOffset: number
    namesOffset: number
    typesCount: number
}

interface ResoureMacType {
    id: string
    count: number
    startOffset: number
}

const kResourceMacEntryNameLength = 64

interface ResourceMacEntry {
    id: number
    nameOffset: number
    dataOffset: number
    name: string
}

class ResourceMac {
    static FILENAME1 = "Flashback.bin"
    static FILENAME2 = "Flashback.rsrc"

    _f: File = new File()

    _dataOffset: number
    _map: ResourceMacMap
    _types: ResoureMacType[]
    _entries: ResourceMacEntry[]

    constructor() {
        this._dataOffset = 0
        this._types = null
        this._entries = null
        this._map = {
            typesOffset: 0,
            namesOffset: 0,
            typesCount: 0,
        }
    }

    async open(filePath: string, fs: FileSystem) {
        return await this._f.open(filePath, "rb", fs)       
    }

    isOpen() {
        return this._entries.length !== 0
    }

    load() {
        const _f = this._f
        const sig = _f.readUint32BE()
        if (sig === 0x00051607) {
            console.log('Load Macintosh data from AppleDouble')
            _f.seek(24)
            const count = _f.readUint16BE()
            for (let i = 0; i < count; ++i) {
                const id = _f.readUint32BE()
                const offset = _f.readUint32BE()
                const length = _f.readUint32BE()
                if (id === 2) {
                    this.loadResourceFork(offset, length)
                    break
                }
            }
        } else {
            console.log('Load Macintosh data from MacBinary')
            _f.seek(83)
            const dataSize = _f.readUint32BE()
            const resourceOffset = 128 + ((dataSize + 127) & ~127)
            this.loadResourceFork(resourceOffset, dataSize)
        }
    }

    loadResourceFork(resourceOffset: number, dataSize: number) {
        const _f = this._f
        _f.seek(resourceOffset)
        this._dataOffset = resourceOffset + _f.readUint32BE()
        const mapOffset = resourceOffset + _f.readUint32BE()

        _f.seek(mapOffset + 22)
        _f.readUint16BE()
        this._map.typesOffset = _f.readUint16BE()
        this._map.namesOffset = _f.readUint16BE()
        this._map.typesCount = _f.readUint16BE() + 1
    
        _f.seek(mapOffset + this._map.typesOffset + 2)
        const _types = new Array(this._map.typesCount)

        for (let i = 0; i < this._map.typesCount; ++i) {
           _types[i] = {
                id: _f.readString(4),
                count: _f.readUint16BE() + 1,
                startOffset: _f.readUint16BE(),
            }
        }
        this._types = _types

        const _entries = new Array(this._map.typesCount)
        for (let i = 0; i < this._map.typesCount; ++i) {
            _f.seek(mapOffset + this._map.typesOffset + _types[i].startOffset)
            _entries[i] = new Array(_types[i].count)
            for (let j = 0; j < _types[i].count; ++j) {
                _entries[i][j] = {
                    id: _f.readUint16BE(),
                    nameOffset: _f.readUint16BE(),
                    dataOffset: _f.readUint32BE() & 0x00FFFFFF,
                }
                _f.readUint32BE();
            }
            for (let j = 0; j < _types[i].count; ++j) {
                if (_entries[i][j].nameOffset != 0xFFFF) {
                    _f.seek(mapOffset + this._map.namesOffset + _entries[i][j].nameOffset)
                    const len = _f.readByte();
                    if (len >= kResourceMacEntryNameLength - 1) {
                        throw(`assertion failed: (${len} < ${kResourceMacEntryNameLength - 1}`)
                    }
                    _entries[i][j].name = _f.readString(len)
                }
            }
        }
        this._entries = _entries
    }

    findEntry(name: string) {

    }
}

export { ResourceMac }
