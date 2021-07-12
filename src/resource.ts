import { fileExists, removeFolder } from 'fuse-box/utils/utils'
import type { DecodeBuffer } from './decode_mac'
import { decodeC211, decodeC103 } from './decode_mac'
import { File } from './file'
import { FileSystem } from "./fs"
import { Color, InitPGE, Language, ObjectNode, READ_BE_UINT16, READ_BE_UINT32, READ_LE_UINT16, READ_LE_UINT32, ResourceType, SoundFx, CLIP, BankSlot, Buffer, CreateInitPGE, CreateObj } from "./intern"
import { ResourceAba } from "./resource_aba"
import { ResourceMac } from "./resource_mac"
import { _cineBinJP, _cineTxtJP, _gameSavedSoundLen, _level1TbnJP, _level2TbnJP, _level3TbnJP, _level41TbnJP, _level42TbnJP, _level51TbnJP, _level52TbnJP, _splNames, _spmOffsetsTable, _stringsTableDE, _stringsTableEN, _stringsTableFR, _stringsTableIT, _stringsTableJP, _stringsTableSP, _textsTableDE, _textsTableEN, _textsTableFR, _textsTableIT, _textsTableSP, _voicesOffsetsTable, _gameSavedSoundData } from './staticres'
import { bytekiller_unpack } from './unpack'
import { dump } from './util'

type LoadStub = (file: File) => void

const normalizeSPL = (sfx: SoundFx) => {
	const kGain = 2

	sfx.peak = Math.abs(sfx.data[0])
	for (let i = 1; i < sfx.len; ++i) {
		const sample = sfx.data[i]
		if (Math.abs(sample) > sfx.peak) {
			sfx.peak = Math.abs(sample)
		}
		sfx.data[i] = (sample / kGain) >> 0
	}
}

const LocaleData = {
    Id: {
            LI_01_CONTINUE_OR_ABORT: 0,
            LI_02_TIME: 1,
            LI_03_CONTINUE: 2,
            LI_04_ABORT: 3,
            LI_05_COMPLETED: 4,
            LI_06_LEVEL: 5,
            LI_07_START: 6,
            LI_08_SKILL: 7,
            LI_09_PASSWORD: 8,
            LI_10_INFO: 9,
            LI_11_QUIT: 10,
            LI_12_SKILL_LEVEL: 11,
            LI_13_EASY: 12,
            LI_14_NORMAL: 13,
            LI_15_EXPERT: 14,
            LI_16_ENTER_PASSWORD1: 15,
            LI_17_ENTER_PASSWORD2: 16,
            LI_18_RESUME_GAME: 17,
            LI_19_ABORT_GAME: 18,
            LI_20_LOAD_GAME: 19,
            LI_21_SAVE_GAME: 20,
            LI_22_SAVE_SLOT: 21,
            LI_23_DEMO: 22,
            LI_NUM: 23
        },
    _textsTableFR: _textsTableFR,
    _textsTableEN: _textsTableEN,
    _textsTableDE: _textsTableDE,
    _textsTableSP: _textsTableSP,
    _textsTableIT: _textsTableIT,

    _stringsTableFR: _stringsTableFR,
    _stringsTableEN: _stringsTableEN,
    _stringsTableDE: _stringsTableDE,
    _stringsTableSP: _stringsTableSP,
    _stringsTableIT: _stringsTableIT,
    _stringsTableJP: _stringsTableJP,

    _level1TbnJP: _level1TbnJP,
    _level2TbnJP: _level2TbnJP,
    _level3TbnJP: _level3TbnJP,
    _level41TbnJP: _level41TbnJP,
    _level42TbnJP: _level42TbnJP,
    _level51TbnJP: _level51TbnJP,
    _level52TbnJP: _level52TbnJP,

    _cineBinJP: _cineBinJP,
    _cineTxtJP: _cineTxtJP,
}

enum ObjectType {
    OT_MBK,
    OT_PGE,
    OT_PAL,
    OT_CT,
    OT_MAP,
    OT_SPC,
    OT_RP,
    OT_RPC,
    OT_DEMO,
    OT_ANI,
    OT_OBJ,
    OT_TBN,
    OT_SPR,
    OT_TAB,
    OT_ICN,
    OT_FNT,
    OT_TXTBIN,
    OT_CMD,
    OT_POL,
    OT_SPRM,
    OT_OFF,
    OT_CMP,
    OT_OBC,
    OT_SPL,
    OT_LEV,
    OT_SGD,
    OT_BNQ,
    OT_SPM
}

const NUM_SFXS = 66
const NUM_BANK_BUFFERS = 50
const NUM_CUTSCENE_TEXTS = 117
const NUM_SPRITES = 1287

const kPaulaFreq = 3546897
const kClutSize = 1024
const kScratchBufferSize = 320 * 224 + 1024

class Resource {
	static _voicesOffsetsTable: Uint16Array = _voicesOffsetsTable
	static _spmOffsetsTable: Uint32Array = _spmOffsetsTable
	static _splNames: string[] = _splNames
	static _gameSavedSoundData: Uint8Array = _gameSavedSoundData
	static _gameSavedSoundLen: number = _gameSavedSoundLen
    static getCineName = (lang: Language, type: ResourceType) => {
        switch(lang) {
            case Language.LANG_FR:
                if (type === ResourceType.kResourceTypeAmiga) {
                    return "FR"
                }
                return "FR_"

            case Language.LANG_DE:
                return "GER"

            case Language.LANG_SP:
                return "SPA"

            case Language.LANG_IT:
                return "ITA"

            case Language.LANG_EN:
            default:
                return "ENG"
        }
    }
    static getTextBin(lang: Language, type: ResourceType) {
        // FB PC-CD version has language specific files
        // .TBN is used as fallback if open fails
        switch (lang) {
        case Language.LANG_FR:
            return "TBF"
        case Language.LANG_DE:
            return "TBG"
        case Language.LANG_SP:
            return "TBS"
        case Language.LANG_IT:
            return "TBI"
        case Language.LANG_EN:
        default:
            return "TBN"
        }
    }

    _fs: FileSystem
    _type: ResourceType
    _lang: Language
    _isDemo: boolean
    _aba: ResourceAba
    _mac: ResourceMac
    _readUint16: (buf: ArrayBuffer|Buffer|Uint8Array, offset?) => number
    _readUint32: (buf: ArrayBuffer|Buffer|Uint8Array, offset?) => number
    _scratchBuffer: Uint8Array
    _bankData: Uint8Array
    _bankDataHead: Uint8Array
    _bankDataTail: number
	_bankBuffersCount: number
    _bankBuffers: BankSlot[] = new Array(NUM_BANK_BUFFERS).fill(null).map(() => ({
        entryNum: 0,
        ptr: null,
    }))
    _hasSeqData: boolean
    _entryName: string
    _fnt: Uint8Array
    _mbk: Uint8Array
    _icn: Uint8Array
    _icnLen: number
    _tab: Uint8Array
    _spc: Uint8Array
    _numSpc: number
    _rp: Uint8Array = new Uint8Array(0x4A)
    _pal: Uint8Array
    _ani: Uint8Array
    _tbn: Uint8Array
    _ctData: Int8Array = new Int8Array(0x1D00)
    _spr1: Uint8Array
    _sprData: Uint8Array[] = new Array(NUM_SPRITES)
    _sprm: Uint8Array = new Uint8Array(0x10000)
    _pgeNum: number
    _pgeInit: InitPGE[] = new Array(256).fill(null).map(() => CreateInitPGE())
    _map: Uint8Array
    _lev: Uint8Array
    _levNum: number
    _sgd: Uint8Array
    _bnq: Uint8Array
    _numObjectNodes: number
    _objectNodesMap: ObjectNode[] = new Array(255)
    _sfxList: SoundFx[]
    _numSfx: number
    _cmd: Uint8Array
    _pol: Uint8Array
    _cineStrings: Uint8Array[]
    _cine_off: Uint8Array
    _cine_txt: Uint8Array
    _textsTable: string[]
    _stringsTable: Uint8Array
    _dem: Uint8Array
    _demLen: number
    _resourceMacDataSize: number
    _clutSize: number
    _clut: Color[]
    _perso: Uint8Array
    _monster: Uint8Array
    _str: Uint8Array
    _credits: Uint8Array

    constructor(fs: FileSystem, ver: ResourceType, lang: Language) {
        // 	memset(this, 0, sizeof(Resource));
        this._fs = fs
        this._type = ver
        this._lang = lang
        this._isDemo = false
        this._aba = null
        this._mac = null
        this._cine_txt = null
        this._cine_off = null
        this._perso = null
        this._monster = null
        this._str = null
        this._credits = null
        this._dem = null
        this._demLen = 0
        this._resourceMacDataSize = 0
        this._cmd = null
        this._pol = null
        this._cineStrings = null
        this._fnt = null
        this._mbk = null
        this._icn = null
        this._icnLen = 0
        this._tab = null
        this._spc = null
        this._numSpc = 0
        this._pal = null
        this._ani = null
        this._tbn = null
        this._spr1 = null
        // this._sprData = null
        // this._sprm = null
        this._pgeNum = 0
        // this._pgeInit = null
        this._map = null
        this._lev = null
        this._levNum = 0
        this._sgd = null
        this._bnq = null
        this._readUint16 = (this._type === ResourceType.kResourceTypeDOS) ? READ_LE_UINT16 : READ_BE_UINT16
        this._readUint32 = (this._type === ResourceType.kResourceTypeDOS) ? READ_LE_UINT32 : READ_BE_UINT32
        this._scratchBuffer = new Uint8Array(kScratchBufferSize)
        if (!this._scratchBuffer) {
            throw("Unable to allocate temporary memory buffer");
        }
        const kBankDataSize = 0x7000
        this._bankData = new Uint8Array(kBankDataSize)
        if (!this._bankData) {
            throw("Unable to allocate bank data buffer");
        }
        this._bankDataTail = kBankDataSize
        this.clearBankData()
    }

	isDOS(): boolean {
        return this._type === ResourceType.kResourceTypeDOS
    }

	isAmiga() {
        return this._type === ResourceType.kResourceTypeAmiga 
    }

	isMac() {
        return this._type === ResourceType.kResourceTypeMac
    }

    MAC_decodeImageData(ptr: Uint8Array, i: number, dst: DecodeBuffer) {
        const basePtr = ptr
        let ptr_offset = 0
        const sig = READ_BE_UINT16(ptr)
        ptr_offset = 2
        if(sig !== 0xC211 && sig !== 0xC103) {
            throw(`assertion failed: ${sig} === 0xC211 || ${sig} === 0xC103`)
        }
        const count = READ_BE_UINT16(ptr, ptr_offset)
        ptr_offset += 2
        if (i >= count) {
            throw(`assertion failed: ${i} count`)
        }
        ptr_offset += 4
        const offset = READ_BE_UINT16(ptr, ptr_offset + i * 4)
        if (offset !== 0) {
            ptr_offset = offset
            const w = READ_BE_UINT16(ptr, ptr_offset)
            ptr_offset += 2
            const h = READ_BE_UINT16(ptr, ptr_offset)
            ptr_offset += 2
            switch(sig) {
                case 0xC211:
                    decodeC211(new Uint8Array(ptr, ptr_offset + 4), w, h, dst)
                    break

                case 0xC103:
                    decodeC103(new Uint8Array(ptr, ptr_offset), w, h, dst)
                    break                    
            }
        }
    }

    async init() {
        switch(this._type) {
            case ResourceType.kResourceTypeAmiga:
                this._isDemo = this._fs.exists("demo.lev")
                break
            case ResourceType.kResourceTypeDOS:
                if (this._fs.exists(ResourceAba.FILENAME)) {
                    this._aba = new ResourceAba(this._fs)
                    await this._aba.readEntries()
                    this._isDemo = true
                }
                if (!this.fileExists("LEVEL1.MAP")) {
                    this._isDemo = true
                }
                break
            case ResourceType.kResourceTypeMac:
                // TODO
                debugger
                // if (this._fs.exists(ResourceMac.FILENAME1)) {
                //     this._mac = new ResourceMac()
                //     await this._mac.open(ResourceMac.FILENAME1, this._fs)
                // } else if (this._fs.exists(ResourceMac.FILENAME2)) {
                //     this._mac = new ResourceMac()
                //     await this._mac.open(ResourceMac.FILENAME2, this._fs)
                // }
                // this._mac.load()
                break
        }
    }

    unload(objType: number) {
        switch (objType) {
            case ObjectType.OT_CMD:
                this._cmd = null
                break
            case ObjectType.OT_POL:
                this._pol = null
                break
            case ObjectType.OT_CMP:
                this._cmd = null
                this._pol = null
                break
            default:
                console.error(`Unimplemented Resource::unload() type ${objType}`)
                break
            }
    }

    async load(objName: string, objType: number, ext: string = "") {
        let loadStub:LoadStub = null
        switch(objType) {
            case ObjectType.OT_RP:
                this._entryName = `${objName}.RP`
                loadStub = this.load_RP.bind(this)
                break

            case ObjectType.OT_PAL:
                this._entryName = `${objName}.PAL`
                loadStub = this.load_PAL.bind(this)
                break

            case ObjectType.OT_TBN:
                this._entryName = `${objName}.${Resource.getTextBin(this._lang, this._type)}`
                if (!this._fs.exists(this._entryName)) {
                    this._entryName = `${objName}.TBN`
                }
                loadStub = this.load_TBN.bind(this)
                break;

            case ObjectType.OT_ANI:
                this._entryName = `${objName}.ANI`
                loadStub = this.load_ANI.bind(this)
                break

            case ObjectType.OT_BNQ:
                this._entryName = `${objName}.BNQ`
                loadStub = this.load_BNQ.bind(this)
                break

            case ObjectType.OT_SPM:
                this._entryName = `${objName}.SPM`
                loadStub = this.load_SPM.bind(this)
                break

            case ObjectType.OT_SPRM:
                this._entryName = `${objName}.SPR`
                loadStub = this.load_SPRM.bind(this)
                break

            case ObjectType.OT_MBK:
                this._entryName = `${objName}.MBK`
                loadStub = this.load_MBK.bind(this)
                break

            case ObjectType.OT_FNT:
                this._entryName = `${objName}.FNT`
                loadStub = this.load_FNT.bind(this)
                break

            case ObjectType.OT_CMD:
                this._entryName = `${objName}.CMD`
                loadStub = this.load_CMD.bind(this)
                break

            case ObjectType.OT_PGE:
                this._entryName = `${objName}.PGE`
                loadStub = this.load_PGE.bind(this)
                break

            case ObjectType.OT_CT:
                this._entryName = `${objName}.CT`
                loadStub = this.load_CT.bind(this)
                break

            case ObjectType.OT_POL:
                this._entryName = `${objName}.POL`
                loadStub = this.load_POL.bind(this)
                break                

            case ObjectType.OT_ICN:
                this._entryName = `${objName}.ICN`
                loadStub = this.load_ICN.bind(this)
                break

            case ObjectType.OT_SPC:
                this._entryName = `${objName}.SPC`
                loadStub = this.load_SPC.bind(this)
                break

            case ObjectType.OT_SPR:
                this._entryName = `${objName}.SPR`
                loadStub = this.load_SPR.bind(this)
                break

            case ObjectType.OT_SGD:
                this._entryName = `${objName}.SGD`
                loadStub = this.load_SGD.bind(this)
                break

            case ObjectType.OT_LEV:
                this._entryName = `${objName}.LEV`
                loadStub = this.load_LEV.bind(this)
                break

            case ObjectType.OT_OBJ:
                this._entryName = `${objName}.OBJ`
                loadStub = this.load_OBJ.bind(this)
                break

            default:
                throw(`load not implemented for ${objType} !`)
                break
        }

        if (ext) {
            this._entryName = `${objName}.${ext}`
        }

        const f:File = new File()
        if (await f.open(this._entryName, "rb", this._fs)) {
            if (!loadStub) {
                throw(`assertion failed ${loadStub}`)
            }
            loadStub(f)
            if (f.ioErr()) {
                throw(`I/O error when reading '${this._entryName}'`)
            }
        } else {
            if (this._aba) {
                const { dat, size } = this._aba.loadEntry(this._entryName)
                if (dat) {
                    switch(objType) {
                        case ObjectType.OT_PAL:
                            this._pal = dat
                            break                        
                        case ObjectType.OT_MBK:
                            this._mbk = dat
                            break
                        case ObjectType.OT_FNT:
                            this._fnt = dat
                            break
                        case ObjectType.OT_PGE:
                            this.decodePGE(dat, size)
                            break                            
                        case ObjectType.OT_BNQ:
                            this._bnq = dat
                            break
                        case ObjectType.OT_ANI:
                            this._ani = dat
                            break
                        case ObjectType.OT_TBN:
                            this._tbn = dat
                            break                            
                        case ObjectType.OT_RP:
                            if (size !== 0x4A) {
                                throw(`Unexpected size ${size} for '${this._entryName}'`)
                            }
                            this._rp.set(dat.subarray(0, size))
                            break                            
                        case ObjectType.OT_CMD:
                            this._cmd = dat
                            break
                        case ObjectType.OT_CT:
                            if (!bytekiller_unpack(new Uint8Array(this._ctData.buffer), this._ctData.byteLength, dat, size)) {
                                debugger
                                throw(`Bad CRC for '${this._entryName}`)
                            }
                            break                            
                        case ObjectType.OT_POL:
                            this._pol = dat
                            break
                        case ObjectType.OT_ICN:
                            this._icn = dat
                            break
                        case ObjectType.OT_SPC:
                            this._spc = dat
                            this._numSpc = READ_BE_UINT16(this._spc.buffer) / 2
                            break
                        case ObjectType.OT_OBJ:
                            this._numObjectNodes = READ_LE_UINT16(dat)
                            if (this._numObjectNodes !== 230) {
                                throw(`Assertion failed: ${this._numObjectNodes === 230}`)
                            }
                            this.decodeOBJ(dat.subarray(2, size - 2), size - 2)
                            break
                        default:
                            debugger
                            throw(`${objType} not supported!`)
                            break
                    }
                    return
                }
            } else if (this._isDemo) {
                switch(objType) {
                    case ObjectType.OT_CMD:
                    case ObjectType.OT_POL:
                        console.warn(`Unable to load '${this._entryName}' type %${objType}`)
                }
            }
            throw(`Cannot open ${this._entryName}`)
        }
    }

    decodePGE(p: Uint8Array, size: number) {
        let index = 0
        this._pgeNum = this._readUint16(p)
        index += 2
        this._pgeInit = this._pgeInit.fill(null).map(() => CreateInitPGE())
        if (this._pgeNum > this._pgeInit.length) {
            throw(`Assertion failed: ${this._pgeNum} <= ${this._pgeInit.length}`)
        }
        for (let i = 0; i < this._pgeNum; ++i) {
            const pge: InitPGE = this._pgeInit[i]
            pge.type = this._readUint16(p, index)
            index += 2
            pge.pos_x = this._readUint16(p, index)
            index += 2
            pge.pos_y = this._readUint16(p, index)
            index += 2
            pge.obj_node_number = this._readUint16(p, index)
            index += 2
            pge.life = this._readUint16(p, index)
            index += 2
            for (let lc = 0; lc < 4; ++lc) {
                pge.counter_values[lc] = this._readUint16(p, index)
                index += 2
            }
            pge.object_type = p[index++]
            pge.init_room = p[index++]
            pge.room_location = p[index++]
            pge.init_flags = p[index++]
            pge.colliding_icon_num = p[index++]
            pge.icon_num = p[index++]
            pge.object_id = p[index++]
            pge.skill = p[index++]
            pge.mirror_x = p[index++]
            pge.flags = p[index++]
            pge.unk1C = p[index++]
            index++
            pge.text_num = this._readUint16(p, index)
            index += 2
        }        
    }

    decodeOBJ(tmp: Uint8Array, size: number) {
        const offsets = new Uint32Array(256)
        let tmpOffset = 0
        this._numObjectNodes = 230
        if (this._type === ResourceType.kResourceTypeMac) {
            this._numObjectNodes = this._readUint16(tmp)
            tmpOffset += 2
        }
        for (let i = 0; i <this. _numObjectNodes; ++i) {
            offsets[i] = this._readUint32(tmp, tmpOffset)
            tmpOffset += 4
        }
        offsets[this._numObjectNodes] = size
        let numObjectsCount = 0
        const objectsCount = new Uint16Array(256)
        for (let i = 0; i < this._numObjectNodes; ++i) {
            let diff = offsets[i + 1] - offsets[i]
            if (diff !== 0) {
                objectsCount[numObjectsCount] = ((diff - 2) / 0x12) >> 0
                ++numObjectsCount
            }
        }
        let prevOffset = 0
        let prevNode: ObjectNode = null
        let iObj = 0
        for (let i = 0; i < this._numObjectNodes; ++i) {
            if (prevOffset !== offsets[i]) {
                const on: ObjectNode = {
                    last_obj_number: 0,
                    objects: null,
                    num_objects: 0
                }
                if (!on) {
                    throw(`Unable to allocate ObjectNode num=${i}`)
                }
                let objData = offsets[i]
                on.last_obj_number = this._readUint16(tmp, objData)
                objData += 2
                on.num_objects = objectsCount[iObj]
                on.objects = new Array(on.num_objects)
                for (let j = 0; j < on.num_objects; ++j) {
                    // Object *obj = &on->objects[j];
                    const obj = CreateObj()
                    obj.type = this._readUint16(tmp, objData)
                    objData += 2
                    obj.dx = tmp[objData++] << 24 >> 24
                    obj.dy = tmp[objData++] << 24 >> 24
                    obj.init_obj_type = this._readUint16(tmp, objData)
                    objData += 2
                    obj.opcode2 = tmp[objData++]
                    obj.opcode1 = tmp[objData++]
                    obj.flags = tmp[objData++]
                    obj.opcode3 = tmp[objData++]
                    obj.init_obj_number = this._readUint16(tmp, objData)
                    objData += 2
                    obj.opcode_arg1 = this._readUint16(tmp, objData) << 16 >> 16
                    objData += 2
                    obj.opcode_arg2 = this._readUint16(tmp, objData) << 16 >> 16
                    objData += 2
                    obj.opcode_arg3 = this._readUint16(tmp, objData) << 16 >> 16
                    objData += 2
                    on.objects[j] = obj
                }
                ++iObj
                prevOffset = offsets[i]
                prevNode = on
            }
            this._objectNodesMap[i] = prevNode
        }
    }

    load_SPM(f: File) {
        debugger
        const kPersoDatSize = 178647
        const len = f.size()
        f.seek(len - 4)
        const size = f.readUint32BE()
        f.seek(0)
        const tmp = new Uint8Array(len)
        if (!tmp) {
            throw("Unable to allocate SPM temporary buffer")
        }
        f.read(tmp.buffer, len)
        if (size === kPersoDatSize) {
            this._spr1 = new Uint8Array(size)
            if (!this._spr1) {
                throw("Unable to allocate SPR1 buffer")
            }
            if (!bytekiller_unpack(this._spr1, size, tmp, len)) {
                throw("Bad CRC for SPM data")
            }
        } else {
            if (size > this._sprm.byteLength) {
                throw(`Assertion error: ${size} <= ${this._sprm.byteLength}`)
            }
            // assert(size <= sizeof(_sprm));
            if (!bytekiller_unpack(this._sprm, this._sprm.byteLength, tmp, len)) {
                throw("Bad CRC for SPM data")
            }
        }
        for (let i = 0; i < NUM_SPRITES; ++i) {
            const offset = Resource._spmOffsetsTable[i]
            if (offset >= kPersoDatSize) {
                this._sprData[i] = this._sprm.subarray(offset - kPersoDatSize)
            } else {
                this._sprData[i] = this._spr1.subarray(offset)
            }
        }
    }

    load_SPRM(f: File) {
        const len = f.size() - 12
        if (len > this._sprm.byteLength) {
            throw(`Assertion error: ${len} <= ${this._sprm.byteLength}`)
        }
        f.seek(12)
        f.read(this._sprm.buffer, len)
    }

    load_PGE(f: File) {
        if (this._type === ResourceType.kResourceTypeAmiga) {
            const size = f.size()
            const tmp = new Uint8Array(size)
            if (!tmp) {
                throw("Unable to allocate PGE temporary buffer");
            }
            f.read(tmp.buffer, size)
            this.decodePGE(tmp, size)
            return
        }
        this._pgeNum = f.readUint16LE()
        if (this._pgeNum > this._pgeInit.length) {
            throw(`Assertion error: ${this._pgeNum} <= ${this._pgeInit.length}`)
        }
        for (let i = 0; i < this._pgeNum; ++i) {
            const pge: InitPGE = this._pgeInit[i]
            pge.type = f.readUint16LE()
            pge.pos_x = f.readUint16LE()
            pge.pos_y = f.readUint16LE()
            pge.obj_node_number = f.readUint16LE()
            pge.life = f.readUint16LE()
            for (let lc = 0; lc < 4; ++lc) {
                pge.counter_values[lc] = f.readUint16LE()
            }
            pge.object_type = f.readByte()
            pge.init_room = f.readByte()
            pge.room_location = f.readByte()
            pge.init_flags = f.readByte()
            pge.colliding_icon_num = f.readByte()
            pge.icon_num = f.readByte()
            pge.object_id = f.readByte()
            pge.skill = f.readByte()
            pge.mirror_x = f.readByte()
            pge.flags = f.readByte()
            pge.unk1C = f.readByte()
            f.readByte()
            pge.text_num = f.readUint16LE()
        }
    }

    load_OBJ(f: File) {
        throw('load_OBJ: not implemented!')
        // debug(DBG_RES, "Resource::load_OBJ()");
        // if (_type == kResourceTypeAmiga) { // demo has uncompressed objects data
        //     const int size = f->size();
        //     uint8_t *buf = (uint8_t *)malloc(size);
        //     if (!buf) {
        //         error("Unable to allocate OBJ buffer");
        //     } else {
        //         f->read(buf, size);
        //         decodeOBJ(buf, size);
        //     }
        //     return;
        // }
        // _numObjectNodes = f->readUint16LE();
        // assert(_numObjectNodes < 255);
        // uint32_t offsets[256];
        // for (int i = 0; i < _numObjectNodes; ++i) {
        //     offsets[i] = f->readUint32LE();
        // }
        // offsets[_numObjectNodes] = f->size() - 2;
        // int numObjectsCount = 0;
        // uint16_t objectsCount[256];
        // for (int i = 0; i < _numObjectNodes; ++i) {
        //     int diff = offsets[i + 1] - offsets[i];
        //     if (diff != 0) {
        //         objectsCount[numObjectsCount] = (diff - 2) / 0x12;
        //         debug(DBG_RES, "i=%d objectsCount[numObjectsCount]=%d", i, objectsCount[numObjectsCount]);
        //         ++numObjectsCount;
        //     }
        // }
        // uint32_t prevOffset = 0;
        // ObjectNode *prevNode = 0;
        // int iObj = 0;
        // for (int i = 0; i < _numObjectNodes; ++i) {
        //     if (prevOffset != offsets[i]) {
        //         ObjectNode *on = (ObjectNode *)malloc(sizeof(ObjectNode));
        //         if (!on) {
        //             error("Unable to allocate ObjectNode num=%d", i);
        //         }
        //         f->seek(offsets[i] + 2);
        //         on->last_obj_number = f->readUint16LE();
        //         on->num_objects = objectsCount[iObj];
        //         debug(DBG_RES, "last=%d num=%d", on->last_obj_number, on->num_objects);
        //         on->objects = (Object *)malloc(sizeof(Object) * on->num_objects);
        //         for (int j = 0; j < on->num_objects; ++j) {
        //             Object *obj = &on->objects[j];
        //             obj->type = f->readUint16LE();
        //             obj->dx = f->readByte();
        //             obj->dy = f->readByte();
        //             obj->init_obj_type = f->readUint16LE();
        //             obj->opcode2 = f->readByte();
        //             obj->opcode1 = f->readByte();
        //             obj->flags = f->readByte();
        //             obj->opcode3 = f->readByte();
        //             obj->init_obj_number = f->readUint16LE();
        //             obj->opcode_arg1 = f->readUint16LE();
        //             obj->opcode_arg2 = f->readUint16LE();
        //             obj->opcode_arg3 = f->readUint16LE();
        //             debug(DBG_RES, "obj_node=%d obj=%d op1=0x%X op2=0x%X op3=0x%X", i, j, obj->opcode2, obj->opcode1, obj->opcode3);
        //         }
        //         ++iObj;
        //         prevOffset = offsets[i];
        //         prevNode = on;
        //     }
        //     _objectNodesMap[i] = prevNode;
        // }
    }

    load_ANI(f: File) {
        const size = f.size()
        this._ani = new Uint8Array(size)
        if (!this._ani) {
            throw("Unable to allocate ANI buffer")
        } else {
            f.read(this._ani.buffer, size)
        }
    }

    load_LEV(f: File) {
        const len = f.size()
        this._lev = new Uint8Array(len)
        if (!this._lev) {
            throw("Unable to allocate LEV buffer")
        } else {
            f.read(this._lev.buffer, len)
        }
    }

    load_BNQ(f: File) {
        const len = f.size()
        this._bnq = new Uint8Array(len)
        if (!this._bnq) {
            throw("Unable to allocate BNQ buffer");
        } else {
            f.read(this._bnq.buffer, len)
        }
    }

    load_SGD(f: File) {
        const len = f.size()
        if (this._type === ResourceType.kResourceTypeDOS) {
            this._sgd = new Uint8Array(len)
            if (!this._sgd) {
                throw("Unable to allocate SGD buffer");
            } else {
                f.read(this._sgd.buffer, len)
                // first byte == number of entries, clear to fix up 32 bits offset
                this._sgd[0] = 0
            }
            return
        }
        f.seek(len - 4)
        const size = f.readUint32BE()
        f.seek(0)
        const tmp = new Uint8Array(len)
        if (!tmp) {
            throw("Unable to allocate SGD temporary buffer")
        }
        f.read(tmp, len)
        this._sgd = new Uint8Array(size)
        if (!this._sgd) {
            throw("Unable to allocate SGD buffer")
        }
        if (!bytekiller_unpack(this._sgd, size, tmp, len)) {
            throw("Bad CRC for SGD data")
        }
    }

    load_PAL(f: File) {
        const len = f.size()
        this._pal = new Uint8Array(len)
        if (!this._pal) {
            throw("Unable to allocate PAL buffer");
        } else {
            f.read(this._pal.buffer, len)
        }
    }

    load_RP(f: File) {
        f.read(this._rp.buffer, 0x4A)
    }

    load_MBK(f: File) {
        const len = f.size()
        this._mbk = new Uint8Array(len)
        if (!this._mbk) {
            throw("Unable to allocate MBK buffer")
        } else {
            f.read(this._mbk.buffer, len)
        }
    }

    load_CT(pf: File) {
        const len = pf.size()
        const tmp = new Uint8Array(len)
        if (!tmp) {
            throw("Unable to allocate CT buffer")
        } else {
            pf.read(tmp.buffer, len)
            if (!bytekiller_unpack(new Uint8Array(this._ctData.buffer), this._ctData.byteLength, tmp, len)) {
                throw("Bad CRC for collision data")
            }
        }
    }

    load_FNT() {
        throw('not implemented: load_FNT!')
    }

    async setLanguage(lang: Language) {
        if (this._lang !== lang) {
            this._lang = lang
            // reload global language specific data files
            this.free_TEXT()
            this.load_TEXT()
            this.free_CINE()
            await this.load_CINE()
        }
    }

    fileExists(filename: string) {
        if (this._fs.exists(filename)) {
            return true
        } else if (this._aba) {
            return this._aba.findEntry(filename) !== null
        }
        return false
    }    

    clearBankData() {
        this._bankBuffersCount = 0
        this._bankDataHead = this._bankData
    }
    
    getBankDataSize(num: number) {
        let len = READ_BE_UINT16(this._mbk, num * 6 + 4)
        switch (this._type) {
        case ResourceType.kResourceTypeAmiga:
            if (len & 0x8000) {
                len = -(len << 16 >> 16)
            }
            break
        case ResourceType.kResourceTypeDOS:
            if (len & 0x8000) {
                if (this._mbk === this._bnq) { // demo .bnq use signed int
                    len = -(len << 16 >> 16)
                    break
                }
                len &= 0x7FFF
            }
            break
        case ResourceType.kResourceTypeMac:
            // assert(0); // different graphics format
            throw('Assertion Failed: should not get there!')
            break
        }
        return len * 32
    }

    findBankData(num: number) {
        for (let i = 0; i < this._bankBuffersCount; ++i) {
            if (this._bankBuffers[i].entryNum === num) {
                return this._bankBuffers[i].ptr
            }
        }
        return null
    }

    loadBankData(num: number) {
        const ptr = this._mbk.subarray(num * 6)
        let dataOffset = READ_BE_UINT32(ptr)
        if (this._type == ResourceType.kResourceTypeDOS) {
            // first byte of the data buffer corresponds
            // to the total count of entries
            dataOffset &= 0xFFFF
        }
        const size = this.getBankDataSize(num)
        const avail = this._bankDataTail - this._bankDataHead.byteOffset

        if (avail < size) {
            this.clearBankData()
        }
        if ((this._bankDataHead.byteOffset + size) > this._bankDataTail) {
            throw(`Assertion failed: ${this._bankDataHead.byteOffset + size} <= ${this._bankDataTail}`)
        }
        if (this._bankBuffersCount >= this._bankBuffers.length) {
            throw(`Assersion failed: ${this._bankBuffersCount} < ${this._bankBuffers.length}`)
        }
        this._bankBuffers[this._bankBuffersCount].entryNum = num
        this._bankBuffers[this._bankBuffersCount].ptr = this._bankDataHead
        const data = this._mbk.subarray(dataOffset)
        if (READ_BE_UINT16(ptr, 4) & 0x8000) {
            this._bankDataHead.set(data.subarray(0, size))
        } else {
            if (dataOffset <= 4) {
                throw(`Assertion failed: ${dataOffset} > 4`)
            }
            if (size !== (READ_BE_UINT32(data.buffer, data.byteOffset - 4) << 32 >> 32)) {
                throw(`Assertion failed: ${size} === ${(READ_BE_UINT32(data.buffer, data.byteOffset - 4) << 32 >> 32)}`)
            }

            if (!bytekiller_unpack(this._bankDataHead, this._bankDataTail, data, 0)) {
                console.error(`Bad CRC for bank data ${num}`)
            }
        }
        const bankData = this._bankDataHead
        this._bankDataHead = this._bankDataHead.subarray(size)
        return bankData
    }

    load_TEXT() {
        this._stringsTable = null
        switch(this._lang) {
            case Language.LANG_FR:
                this._stringsTable = LocaleData._stringsTableFR
                break
            case Language.LANG_EN:
                this._stringsTable = LocaleData._stringsTableEN
                break
            case Language.LANG_DE:
                this._stringsTable = LocaleData._stringsTableDE
                break                
            case Language.LANG_SP:
                this._stringsTable = LocaleData._stringsTableSP
                break                
            case Language.LANG_IT:
                this._stringsTable = LocaleData._stringsTableIT
                break                
            case Language.LANG_JP:
                this._stringsTable = LocaleData._stringsTableJP
                break                
        }

        this._textsTable = null

        switch(this._lang) {
            case Language.LANG_FR:
                this._textsTable = LocaleData._textsTableFR
                break
            case Language.LANG_EN:
                this._textsTable = LocaleData._textsTableEN
                break
            case Language.LANG_DE:
                this._textsTable = LocaleData._textsTableDE
                break                
            case Language.LANG_SP:
                this._textsTable = LocaleData._textsTableSP
                break                
            case Language.LANG_IT:
                this._textsTable = LocaleData._textsTableIT
                break                
            case Language.LANG_JP:
                this._textsTable = LocaleData._textsTableEN
                break             
        }
    }

    load_TBN(f: File) {
        const len = f.size()
        this._tbn = new Uint8Array(len)
        if (!this._tbn) {
            throw("Unable to allocate TBN buffer");
        } else {
            f.read(this._tbn.buffer, len)
        }
    }

    load_CMD(pf: File) {
        throw('TODO: load_CMD')
        const len = pf.size()
        this._cmd = new Uint8Array(len)
        if (!this._cmd) {
            throw('Unable to allocate CMD buffer (size=${len}')
        } else {
            pf.read(this._cmd, len)
        }
    }

    load_POL(pf: File) {
        const len = pf.size()
        this._pol = new Uint8Array(len)
        if (!this._pol) {
            throw('Unable to allocate POL buffer (size=${len}')            
        } else {
            pf.read(this._pol, len)
        }
    }

    load_ICN(f: File) {
        const len = f.size()
        if (this._icnLen === 0) {
            this._icn = new Uint8Array(len)
        } else {
            debugger
            // this._icn = (uint8_t *)realloc(_icn, _icnLen + len);
        }
        if (!this._icn) {
            console.error("Unable to allocate ICN buffer")
        } else {
            debugger
            // FIX ME
            // f.read(this._icn + this._icnLen, len)
        }
        this._icnLen += len
    }

    async load_DEM(filename: string) {
        this._dem = null
        this._demLen = 0
        const f = new File()
        if (await f.open(filename, "rb", this._fs)) {
            this._demLen = f.size()
            this._dem = new Uint8Array(this._demLen)
            if (this._dem) {
                f.read(this._dem, this._demLen)
            }
        } else if (this._aba) {
            const { dat, size } = this._aba.loadEntry(filename)
            this._dem = dat
            if (this._dem) {
                this._demLen = size
            }
        }
    }

    MAC_getPersoFrame(anim): number {
        // TODO
        debugger
        return 0
    }

    MAC_getMonsterFrame(anim): number {
        // TODO
        debugger
        return 0
    }    

    async load_VCE(num: number, segment: number) {
        let res = {
            buf: null as Uint8Array,
            bufSize: 0
        }
        let offset = _voicesOffsetsTable[num]
        if (offset !== 0xFFFF) {
            const p = _voicesOffsetsTable.subarray(offset / 2)
            let pIndex = 0
            offset = p[pIndex++] * 2048
            let count = p[pIndex++]
            if (segment < count) {
                const f = new File()
                if (await f.open("VOICE.VCE", "rb", this._fs)) {
                    let voiceSize = p[pIndex + segment] * 2048 / 5
                    const voiceBuf = new Uint8Array(voiceSize)
                    if (voiceBuf) {
                        let dst = 0
                        offset += 0x2000
                        for (let s = 0; s < count; ++s) {
                            let len = p[pIndex + s] * 2048
                            for (let i = 0; i < (len / (0x2000 + 2048)) >> 0; ++i) {
                                if (s === segment) {
                                    f.seek(offset)
                                    let n = 2048
                                    while (n--) {
                                        let v = f.readByte()
                                        if (v & 0x80) {
                                            v = -(v & 0x7F)
                                        }
                                        voiceBuf[dst++] = (v & 0xFF) >>> 0
                                    }
                                }
                                offset += 0x2000 + 2048
                            }
                            if (s === segment) {
                                break
                            }
                        }

                        res.buf = voiceBuf
                        res.bufSize = voiceSize
                    }
                }
            }
        }
        return res
    }

    load_SPC(f: File) {
        const len = f.size();
        this._spc = new Uint8Array(len)
        if (!this._spc) {
            console.error("Unable to allocate SPC buffer")
        } else {
            f.read(this._spc, len)
            this._numSpc = (READ_BE_UINT16(this._spc.buffer) / 2) >> 0
        }
    }

    load_SPR(f: File) {
        const len = f.size() - 12
        this._spr1 = new Uint8Array(len)
        if (!this._spr1) {
            console.error("Unable to allocate SPR1 buffer");
        } else {
            f.seek(12)
            f.read(this._spr1.buffer, len)
        }
    }

    async load_SPR_OFF(fileName: string, sprData: Uint8Array) {
        this._entryName = `${fileName}.OFF`
        
        let offData: Uint8Array = null
        const f = new File()
        if (await f.open(this._entryName, "rb", this._fs)) {
            const len = f.size()
            offData = new Uint8Array(len)
            if (!offData) {
                console.error("Unable to allocate sprite offsets");
            }
            f.read(offData.buffer, len);
            if (f.ioErr()) {
                console.error(`I/O error when reading '${this._entryName}'`)
            }
        } else if (this._aba) {
            const res = this._aba.loadEntry(this._entryName)
            offData = res.dat
        }

        if (offData) {
            const p = offData
            let index = 0
            let pos
            while ((pos = READ_LE_UINT16(p.buffer, index)) !== 0xFFFF) {
                if (pos >= NUM_SPRITES) {
                    throw(`Assertion failed: ${pos} < ${NUM_SPRITES}`)
                }
                const off = READ_LE_UINT32(p.buffer, index + 2)
                if (off === 0xFFFFFFFF) {
                    this._sprData[pos] = null
                } else {
                    this._sprData[pos] = sprData.subarray(off)
                }
                index += 6
            }
            return
        }
        console.error(`Cannot load '${this._entryName}'`)
    }

    async load_FIB(fileName: string) {
        this._entryName = `${fileName}.FIB`
        const f = new File()
        if (await f.open(this._entryName, "rb", this._fs)) {
            this._numSfx = f.readUint16LE()
            this._sfxList = new Array(this._numSfx).fill(null).map(() => ({
                offset: 0,
                freq: 0,
                len: 0,
                peak: 0,
                data: null,
            }))
            if (!this._sfxList) {
                console.error("Unable to allocate SoundFx table");
            }
            for (let i = 0; i < this._numSfx; ++i) {
                const sfx:SoundFx = this._sfxList[i]
                sfx.offset = f.readUint32LE()
                sfx.len = f.readUint16LE()
                sfx.freq = 6000
                sfx.data = null
            }
            for (let i = 0; i < this._numSfx; ++i) {
                const sfx:SoundFx = this._sfxList[i]
                if (sfx.len === 0) {
                    continue
                }
                f.seek(sfx.offset)
                const len = (sfx.len * 2) - 1
                const data = new Uint8Array(len)
                if (!data) {
                    console.error("Unable to allocate SoundFx data buffer")
                }
                sfx.data = data
                let index = 0
                // Fibonacci-delta decoding
                const codeToDelta:number[] = [ -34, -21, -13, -8, -5, -3, -2, -1, 0, 1, 2, 3, 5, 8, 13, 21 ]
                let c = f.readByte() << 24 >>24
                data[index++] = c
                sfx.peak = Math.abs(c)
                for (let j = 1; j < sfx.len; ++j) {
                    const d = f.readByte()

                    c += codeToDelta[d >> 4]

                    data[index++] = CLIP(c, -128, 127)
                    if (Math.abs(c) > sfx.peak) {
                        sfx.peak = Math.abs(c)
                    }
    
                    c += codeToDelta[d & 15]
                    data[index++] = CLIP(c, -128, 127)
                    if (Math.abs(c) > sfx.peak) {
                        sfx.peak = Math.abs(c)
                    }
                }
                sfx.len = len
            }
            if (f.ioErr()) {
                console.error(`I/O error when reading '${this._entryName}'`)
            }
        } else {
            console.error(`Cannot open '${this._entryName}'`)
        }
    }

    async load_MAP_menu(fileName: string, dstPtr: Uint8Array) {
        const kMenuMapSize = 0x3800 * 4
        this._entryName = `${fileName}.MAP`
        const f = new File()
        if (await f.open(this._entryName, "rb", this._fs)) {
            if (f.read(dstPtr.buffer, kMenuMapSize) != kMenuMapSize) {
                console.error(`Failed to read '${this._entryName}'`)
            }
            if (f.ioErr()) {
                console.error(`I/O error when reading '${this._entryName}'`)
            }
            return
        } else if (this._aba) {
            const { dat, size } = this._aba.loadEntry(this._entryName)
            if (dat) {
                if (size !== kMenuMapSize) {
                    console.error(`Unexpected size ${size} for '${this._entryName}'`)
                }
                dstPtr.set(dat.subarray(0, size))
                return
            }
        }
        console.error(`Cannot load '${this._entryName}'`)
    }

    async load_PAL_menu(fileName: string, dstPtr: Uint8Array) {
        const kMenuPalSize = 768
        this._entryName = `${fileName}.PAL`
        const f = new File()
        if (await f.open(this._entryName, "rb", this._fs)) {
            if (f.read(dstPtr.buffer, kMenuPalSize) !== kMenuPalSize) {
                console.error(`Failed to read '${this._entryName}'`)
            }
            if (f.ioErr()) {
                console.error(`I/O error when reading '${this._entryName}'`)
            }
            return
        } else if (this._aba) {
            const { dat, size } = this._aba.loadEntry(this._entryName)
            if (dat) {
                if (size !== kMenuPalSize) {
                    console.error(`Unexpected size ${size} for '${this._entryName}'`)
                }
                dstPtr.set(dat.subarray(0, size))
                return
            }
        }
        console.error(`Cannot load '${this._entryName}'`)
    }

    async load_CINE() {
        const prefix = Resource.getCineName(this._lang, this._type)
        switch(this._type) {
            case ResourceType.kResourceTypeAmiga:
                if (this._cine_txt === null) {
                    this._entryName = `${prefix}CINE.TXT`
                    const f: File = new File()
                    if (await f.open(this._entryName, "rb", this._fs)) {
                        const len = f.size()
                        this._cine_txt = new Uint8Array(len + 1)
                        if (!this._cine_txt) {
                            throw(`Unable to allocate cinematics text data (size=${len})`)
                        }
                        f.read(this._cine_txt, len)
                        if (f.ioErr()) {
                            throw(`I/O error when reading '${this._entryName}`)
                        }
                        this._cine_txt[len] = 0
                        let p_offset = 0
                        throw('Resource::load_CINE: Amiga loading not implemented')
                        for (let i = 0; i < NUM_CUTSCENE_TEXTS; ++i) {
                        }
                    } else if (this._isDemo) {
                        // file not present in demo datafiles
                        return;                        
                    }
                }
                if (!this._cine_txt) {
                    throw(`Cannot load '${this._entryName}'`)
                }
                break

            case ResourceType.kResourceTypeDOS:
                if (this._cine_off === null) {
                    this._entryName = `${prefix}.BIN`
                    if (!this._fs.exists(this._entryName)) {
                        this._entryName = "ENGCINE.BIN"
                    }
                    const f:File = new File()
                    if (await f.open(this._entryName, "rb", this._fs)) {
                        const len = f.size()
                        this._cine_off = new Uint8Array(len)
                        if (!this._cine_off) {
                            throw(`Unable to allocate cinematics offsets (size=${len})`)
                        }
                        f.read(this._cine_off, len)
                        if (f.ioErr()) {
                            throw(`I/O error when reading '${this._entryName}'`)
                        }
                    } else if (this._aba) {
                        const { dat } = this._aba.loadEntry(this._entryName)
                        this._cine_off = dat
                    } else if (this._isDemo) {
                        return // some demos do not have cutscene datafiles                        
                    }
                }
                if (!this._cine_off) {
                    throw(`Cannot load '${this._entryName}'`)
                }
                if (this._cine_txt === null) {
                    this._entryName = `${prefix}CINE.TXT`
                    if (!this._fs.exists(this._entryName)) {
                        this._entryName = "ENGCINE.TXT"
                    }
                    const f:File = new File()
                    if (await f.open(this._entryName, "rb", this._fs)) {
                        const len = f.size()
                        this._cine_txt = new Uint8Array(len)
                        if (!this._cine_txt) {
                            throw(`Unable to allocate cinematics text data (size=${len})`)
                        }
                        f.read(this._cine_txt, len)
                        if (f.ioErr()) {
                            throw(`I/O error when reading '${this._entryName}`)
                        }
                    } else if (this._aba) {
                        const { dat } = this._aba.loadEntry(this._entryName)
                        this._cine_txt = dat
                    } else if (this._isDemo) {
                        return // some demos do not have cutscene datafiles                            
                    }
                }
                if (!this._cine_txt) {
                    throw(`Cannot load '${this._entryName}'`)
                }
                break
            case ResourceType.kResourceTypeMac:
                this._MAC_loadCutsceneText()
                break
        }
    }

    _MAC_loadCutsceneText() {
        // TODO
        debugger
    }

    MAC_hasLevelMap(level: number, room: number) {
        // TODO
        debugger
        return false
        // char name[64];
        // snprintf(name, sizeof(name), "Level %c Room %d", _macLevelNumbers[level][0], room);
        // return _mac->findEntry(name) != 0;
    }

    MAC_loadMonsterData(name: string, clut: Color[]) {
        // TODO
        debugger
    }

    MAC_loadClutData() {
        // TODO
        debugger
        // const ptr = this.decodeResourceMacData("Flashback colors", false)
        // if (ptr) {
        //     this.MAC_decodeDataCLUT(ptr)
        //     // free(ptr);
        // }
    }
    
    MAC_loadFontData() {
        // TODO
        debugger
        this._fnt = this.decodeResourceMacData("Font", true)
    }

    decodeResourceMacData(name: string, decompressLzss: boolean): Uint8Array {
        // TODO
        debugger
        return null
    }

    getAniData(num: number) {
		if (this._type == ResourceType.kResourceTypeMac) {
			const count = READ_BE_UINT16(this._ani.buffer)
            if (num >= count) {
                throw(`Assertion failed: ${num} < ${count}`)
            }
			const offset = READ_BE_UINT16(this._ani.buffer, 2 + num * 2)
			return this._ani.subarray(offset)
		}
		const offset = this._readUint16(this._ani, 2 + num * 2)
		return this._ani.subarray(2 + offset)
	}

    async load_SPL_demo() {
        this._numSfx = NUM_SFXS
        this._sfxList = new Array<SoundFx>(NUM_SFXS).fill(null).map(() => ({
            offset: 0,
            len: 0,
            freq: 0,
            data: null,
            peak: 0
        }))
        if (!this._sfxList) {
            return
        }
        for (let i = 0; _splNames[i] && i < NUM_SFXS; ++i) {
            const f = new File()
            if (await f.open(_splNames[i], "rb", this._fs)) {
                const sfx = this._sfxList[i]
                const size = f.size()
                const buffer = new SharedArrayBuffer(f.size())
                sfx.data = new Uint8Array(buffer)
                if (sfx.data) {
                    f.read(sfx.data.buffer, size)
                    sfx.offset = 0
                    sfx.len = size
                    sfx.freq = (kPaulaFreq / 650) >> 0
                    normalizeSPL(sfx)
                }
            }
        }        
    }

    async MAC_loadCutscene(cutscene: string) {
        // TODO
        throw('Resource::MAC_loadCutscene not implemented!')
    }

    MAC_unloadCutscene() {
        this._cmd = null
        this._pol = null
    }

    free_TEXT() {
        this._stringsTable = null
        this._textsTable = null
    }

    free_CINE() {
        this._cine_off = null
        this._cine_txt = null
    }

    free_OBJ() {
        let prevNode: ObjectNode = null
        for (let i = 0; i < this._numObjectNodes; ++i) {
            if (this._objectNodesMap[i] !== prevNode) {
                const curNode = this._objectNodesMap[i]
                curNode.objects.length = 0
                prevNode = curNode
            }
            this._objectNodesMap[i] = null
        }
    }

    getTextString(level: number, num: number) {
		if (this._type === ResourceType.kResourceTypeMac) {
			const count = READ_BE_UINT16(this._tbn)
            if (num >= count) {
                throw(`Assertion failed: ${num} < ${count}`)
            }
			const offset = READ_BE_UINT16(this._tbn, 2 + num * 2)
			return this._tbn.subarray(offset)
		}
		if (this._lang === Language.LANG_JP) {
			let p:Uint8Array = null
			switch (level) {
			case 0:
				p = LocaleData._level1TbnJP
				break
			case 1:
				p = LocaleData._level2TbnJP
				break
			case 2:
				p = LocaleData._level3TbnJP
				break
			case 3:
				p = LocaleData._level41TbnJP
				break
			case 4:
				p = LocaleData._level42TbnJP
				break
			case 5:
				p = LocaleData._level51TbnJP
				break
			case 6:
				p = LocaleData._level52TbnJP
				break
			default:
				return null
			}
			return p.subarray(READ_LE_UINT16(p, num * 2))
		}
		return this._tbn.subarray(this._readUint16(this._tbn, num * 2))
	}

	getGameString(num: number) {
		if (this._type === ResourceType.kResourceTypeMac) {
			const count = READ_BE_UINT16(this._str)
            if (num >= count) {
                throw(`Assertion failed: ${num} < ${count}`)
            }
			const offset = READ_BE_UINT16(this._str, 2 + num * 2)
			return this._str.subarray(offset)
		}
		return this._stringsTable.subarray(READ_LE_UINT16(this._stringsTable, num * 2))
	}

	getCineString(num: number) {
		if (this._type == ResourceType.kResourceTypeMac) {
			const count = READ_BE_UINT16(this._cine_txt)
            if (num >= count) {
                throw(`Assertion failed: ${num} < ${count}`)
            }
			const offset = READ_BE_UINT16(this._cine_txt, 2 + num * 2)
			return this._cine_txt.subarray(offset)
		}

		if (this._lang === Language.LANG_JP) {
			const offset = READ_BE_UINT16(LocaleData._cineBinJP,  num * 2)
			return LocaleData._cineTxtJP.subarray(offset)
		}
		if (this._cine_off) {
			const offset = READ_BE_UINT16(this._cine_off, num * 2)
			return this._cine_txt.subarray(offset)
		}
		return (num >= 0 && num < NUM_CUTSCENE_TEXTS) ? this._cineStrings[num] : 0;
	}

	getMenuString(num: number) {
		return (num >= 0 && num < LocaleData.Id.LI_NUM) ? this._textsTable[num] : "";
	}

    MAC_copyClut16(clut: Color[], dest: number, src: number) {
        // TODO
        debugger
        // memcpy(&clut[dest * 16], &_clut[src * 16], 16 * sizeof(Color));

    }

    clearLevelRes() {
        this._tbn = null
        this._mbk = null
        this._pal = null
        this._map = null
        this._lev = null
        this._levNum = -1
        this._sgd = null
        this._bnq = null
        this._ani = null
        this.free_OBJ()
    }

    destructor() {
        throw 'resource::descrutor not implemented!'
    }
}

export { LocaleData, kScratchBufferSize, Resource, ObjectType }
