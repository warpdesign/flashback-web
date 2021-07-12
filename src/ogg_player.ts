import { FileSystem } from "./fs";
import { Mixer } from "./mixer";

class OggDecoder_impl {
    _channels: number
    _open: boolean
    _readBuf: Int16Array
    _readBufSize: number

    constructor() {

    }
}

class OggPlayer {
    _mix: Mixer
    _fs: FileSystem
    _impl: OggDecoder_impl

    constructor(mixer: Mixer, fs: FileSystem) {
        this._mix = mixer
        this._fs = fs
        this._impl = null
    }

    playTrack(track: number) {
        return false
    }

    pauseTrack() {
        throw('OggPlayer::pauseTrack() not implemented!')
    }

    resumeTrack() {
        throw('OggPlayer::resumeTrack() not implemented!')
    }    
}

export { OggPlayer }