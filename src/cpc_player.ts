import { File } from "./file";
import { FileSystem } from "./fs";
import { Mixer } from "./mixer";

class CpcPlayer {
    _mix: Mixer
    _fs: FileSystem
    _f: File
    _pos: number
    _nextPos: number
    _restartPos: number
    _compression: string
    _samplesLeft: number
    _sampleL: number
    _sampleR: number

    constructor(mixer: Mixer, fs: FileSystem) {
        this._mix = mixer
        this._fs = fs
    }

    playTrack(num: number) {
        console.log('cpcPlayer::playTrack: not implemented!')
        return false
    }

    stopTrack() {

    }

    pauseTrack() {
        throw('CpcPlayer::pauseTrack() not implemented!')
    }

    resumeTrack() {
        throw('CpcPlayer::resumeTrack() not implemented!')
    }

    nextChunk() {

    }

    readSampleData() {

    }

    mix(buf: Int16Array, len: number) {

    }

    static mixCallback(param: ArrayBuffer, buf: Int16Array, len: number) {

    }
}

export { CpcPlayer }
