import { CpcPlayer } from "./cpc_player"
import { FileSystem } from "./fs"
import { ADDC_S16, S8_to_S16 } from "./intern"
import { ModPlayer } from "./mod_player"
import { OggPlayer } from "./ogg_player"
import { SfxPlayer } from "./sfx_player"
import { SystemStub } from "./systemstub_web"

class MixerChunk {
    data: Uint8Array
    len: number

    contructor() {
        this.data = null
        this.len = 0
    }

    getPCM(offset: number) {
        if (offset < 0) {
            offset = 0
        } else if (offset >= this.len) {
            offset = this.len - 1
        }
        return this.data[offset]
    }
}

type PremixHook = (userData: ArrayBuffer, buf: Int16Array, len: number) => boolean

enum MusicType {
    MT_NONE,
    MT_MOD,
    MT_OGG,
    MT_SFX,
    MT_CPC,
}

const MUSIC_TRACK = 1000
const NUM_CHANNELS = 4
const FRAC_BITS = 12
const MAX_VOLUME = 64

interface MixerChannel {
    active: boolean
    volume: number
    chunk: MixerChunk
    chunkPos: number
    chunkInc: number
}

class Mixer {
    _fs: FileSystem
    _stub: SystemStub
    _channels: MixerChannel[] = new Array(NUM_CHANNELS).fill(null).map(() => ({
        active: false,
        volume: 0,
        chunk: new MixerChunk(),
        chunkPos: 0,
        chunkInc: 0
    }))
    _premixHook: PremixHook
    _premixHookData: ArrayBuffer
    _backgroundMusicType: MusicType
    _musicType: MusicType
    _cpc: CpcPlayer
    _mod: ModPlayer
    _ogg: OggPlayer
    _sfx: SfxPlayer
    _musicTrack: number
    static MUSIC_TRACK = 1000
    static kUseNr = false
    static isMusicSfx = (num: number) => (num >= 68 && num <= 75)
    static nr = (buf: Int16Array, len: number) => {
        let prev = 0
        for (let i = 0; i < len; ++i) {
            const vnr = buf[i] >> 1
            buf[i] = vnr + prev
            prev = vnr
        }
    }

    constructor(fs: FileSystem, stub: SystemStub) {
        this._stub = stub
        this._musicType = MusicType.MT_NONE
        this._cpc = new CpcPlayer(this, fs)
        this._mod = new ModPlayer(this, fs)
        this._ogg = new OggPlayer(this, fs)
        this._sfx = new SfxPlayer(this)
        this._musicTrack = -1
        this._backgroundMusicType = MusicType.MT_NONE
    }

    init() {
        for (let i = 0; i < NUM_CHANNELS; ++i) {
            this._channels[i] = {
                active: false,
                volume: 0,
                chunk: new MixerChunk(),
                chunkPos: 0,
                chunkInc: 0,
            }
        }
        this._premixHook = null
    }

    playMusic(num: number) {
        if (num > MUSIC_TRACK && num !== this._musicTrack) {
            if (this._ogg.playTrack(num - MUSIC_TRACK)) {
                this._musicType = MusicType.MT_OGG
                this._musicTrack = num
                return
            }
            if (this._cpc.playTrack(num - MUSIC_TRACK)) {
                this._backgroundMusicType = this._musicType = MusicType.MT_CPC
                this._musicTrack = num
                return
            }
        }
        if (num === 1) { // menu screen
            if (this._cpc.playTrack(2) || this._ogg.playTrack(2)) {
                this._backgroundMusicType = this._musicType = MusicType.MT_OGG
                this._musicTrack = 2
                return
            }
        }
        if ((this._musicType == MusicType.MT_OGG || this._musicType == MusicType.MT_CPC) && Mixer.isMusicSfx(num)) { // do not play level action music with background music
            return;
        }
        if (Mixer.isMusicSfx(num)) { // level action sequence
            this._sfx.play(num)
            if (this._sfx._playing) {
                this._musicType = MusicType.MT_SFX
            }
        } else { // cutscene
            this._mod.play(num)
            if (this._mod._playing) {
                this._musicType = MusicType.MT_MOD
            }
        }
    }

    stopMusic() {
        switch(this._musicType) {
            case MusicType.MT_NONE:
                break
            case MusicType.MT_MOD:
                this._mod.stop()
                break
            case MusicType.MT_OGG:
                this._ogg.pauseTrack()
                break
            case MusicType.MT_SFX:
                this._sfx.stop()
                break
            case MusicType.MT_CPC:
                this._cpc.pauseTrack()
                break
        }
        this._musicType = MusicType.MT_NONE
        if (this._musicTrack !== -1) {
            switch(this._backgroundMusicType) {
                case MusicType.MT_OGG:
                    this._ogg.resumeTrack();
                    this._musicType = MusicType.MT_OGG;
                    break;
                case MusicType.MT_CPC:
                    this._cpc.resumeTrack();
                    this._musicType = MusicType.MT_CPC;
                    break;
                default:
                    break;                
            }
        }
    }

    mix(out: Int16Array, len: number) {
        if (this._premixHook) {
            if (!this._premixHook(this._premixHookData, out, len)) {
                this._premixHook = null
                this._premixHookData = null
            }
        }
        for (let i = 0; i < NUM_CHANNELS; ++i) {
            const ch:MixerChannel = this._channels[i]
            if (ch.active) {
                for (let pos = 0; pos < len; ++pos) {
                    if ((ch.chunkPos >> FRAC_BITS) >= (ch.chunk.len - 1)) {
                        ch.active = false
                        break
                    }
                    const sample = ch.chunk.getPCM(ch.chunkPos >> FRAC_BITS) * Math.floor(ch.volume / MAX_VOLUME)
                    out[pos] = ADDC_S16(out[pos], S8_to_S16(sample))
                    ch.chunkPos += ch.chunkInc
                }
            }
        }
        if (Mixer.kUseNr) {
            Mixer.nr(out, len);
        }
    }

    play(data: Uint8Array, len: number, freq: number, volume: number) {
        this._stub.postMessageToSoundProcessor({
            message: 'play',
            buffer: data,
            len,
            freq,
            volume,
        })
        return
    }

    stopAll() {
        for (let i = 0; i < NUM_CHANNELS; ++i) {
            this._channels[i].active = false
        }
    }

    isPlaying(data: Uint8Array) {
        for (let i = 0; i < NUM_CHANNELS; ++i) {
            const ch:MixerChannel = this._channels[i]
            if (ch.active && ch.chunk.data === data) {
                return true
            }
        }
        return false
    }
}

export { Mixer, MAX_VOLUME }
