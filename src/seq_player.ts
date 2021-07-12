import { File } from "./file"
import { Mixer } from "./mixer"
import { _namesTable } from "./staticres"
import { SystemStub } from "./systemstub_web"

const kFrameSize = 6144
const kAudioBufferSize = 882
const kBuffersCount = 30


class SeqDemuxer {
    open(f: File): Promise<boolean> {
        // TODO
        debugger
        return Promise.resolve(true)
    }

    close(): void {

    }

    readHeader(): Promise<boolean> {
        // TODO        
        debugger
        return Promise.resolve(true)
    }

    readFrameData(): Promise<boolean> {
        // TODO        
        debugger
        return Promise.resolve(true)
    }

    fillBuffer(num: number, offset: number, size: number): void {
        // TODO
        debugger
    }

    clearBuffer(num: number): void {
        // TODO
    }

    readPalette(dst: Uint8Array): void {
        // TODO
    }

    readAudio(dst: Int16Array): void {
        // TODO
    }

    _frameOffset: number
    _audioDataOffset: number
    _audioDataSize: number
    _paletteDataSize: number
    _paletteDataOffset: number
    _videoData: number

    _buffers: {
        size: number
        avail: number
        data: Uint8Array
    }[]
    _fileSize: number
    _f: File
}

const kVideoWidth = 256
const kVideoHeight = 128
const kSoundPReloadSize = 4

interface SoundBufferQueue {
    data: Int16Array
    size: number
    read: number
    next: SoundBufferQueue
}

class SeqPlayer {
    static _namesTable: string[] = _namesTable

    constructor(stub: SystemStub, mixer: Mixer) {
        this._stub = stub
        this._mix = mixer
        this._buf = null
        this._soundQueuePreloadSize = 0
        this._soundQueue = null
    }

    setBackBuffer(buf: Uint8Array) {
        this._buf = buf
    }

    play(f: File): void {
        // TODO
    }

    // mix(buf: Int16Array, len: number): boolean {

    // }

    static mixCallback: (param: ArrayBuffer, buf: Int16Array, len: number) => boolean
    
    _stub: SystemStub
    _buf: Uint8Array
    _mix: Mixer
    _demux: SeqDemuxer
    _soundQueuePreloadSize: number
    _soundQueue: SoundBufferQueue
}

export { SeqPlayer }
