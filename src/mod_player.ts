import { FileSystem } from "./fs"
import { Mixer } from "./mixer"
import { _modulesFiles, _periodTable } from "./staticres"

const NUM_SAMPLES = 31
const NUM_TRACKS = 4
const NUM_PATTERNS = 128
const FRAC_BITS = 12
const PAULA_FREQ = 3546897

class ModPlayer_impl {
    _playing: boolean
    _mixingRate: number
    _modInfo: ModuleInfo
    _currentPatternOrder: number
    _currentPatternPos: number
    _currentTick: number
    _songSpeed: number
    _songTempo: number
    _patternDelay: number
    _patternLoopPos: number
    _patternLoopCount: number
    _samplesLeft: number
    _repeatIntro: boolean
    _tracks: Track[]

    contructor() {
        this._playing = false
        this._modInfo = {
            songName: '',
            samples: [],
            numPatterns: 0,
            patternOrderTable: [],
            patternsTable: [],
        }
    }

    findPeriod(period: number, fineTune: number) {
        for (let p = 0; p < 36; ++p) {
            if (ModPlayer._periodTable[p] === period) {
                return fineTune * 36 + p
            }
        }
        console.error("Invalid period=%d", period)
        return 0
    }

    init(rate: number) {
        this._mixingRate = rate
    }
}

class SampleInfo {
    name: string
    len: number
    fineTune: number
    volume: number
    repeatPos: number
    repeatLen: number
    data: Int8Array

    getPCM(offset: number) {
        if (offset < 0) {
            offset = 0;
        } else if (offset >= this.len) {
            offset = this.len - 1
        }
        return this.data[offset]
    }
}

interface ModuleInfo {
    songName: string
    samples: SampleInfo[]
    numPatterns: number
    patternOrderTable: number[]
    patternsTable: number[]
}

interface Track {
    sample: SampleInfo
    volume: number
    pos: number
    freq: number
    period: number
    periodIndex: number
    effectData: number
    vibratoSpeed: number
    vibratoAmp: number
    vibratoPos: number
    portamento: number
    portamentoSpeed: number
    retriggerCounter: number
    delayCounter: number
    cutCounter: number
};

class ModPlayer {
    static _periodTable: Uint16Array = _periodTable
    static _modulesFiles: string[][] = _modulesFiles
    static _modulesFilesCount: number = _modulesFiles.length

    _isAmiga: boolean
    _playing: boolean
    _mix: Mixer
    _fs: FileSystem
    _impl: ModPlayer_impl

    constructor(mixer: Mixer, fs: FileSystem) {
        this._playing = false
        this._mix = mixer
        this._fs = fs
        this._impl = new ModPlayer_impl()
    }

    play(num: number) {
        // console.log(`ModPlayer::play(${num})`)        
    }

    stop() {
        throw('ModPlayer::stop() not implemented!')
    }    
}

export { ModPlayer }
