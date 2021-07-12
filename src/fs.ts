import { FILE } from './file'

interface FileName {
    name: string
    dir: number
}

export class FileSystem_impl {
    _dirsList: string[]
    _dirsCount: number
    _filesList: FileName[]
    _filesCount: number

    constructor() {
        this._dirsList = []
        this._dirsCount = 0
        this._filesList = []
        this._filesCount = 0
    }

    async setRootDirectory(dir: string): Promise<void> {
        await this.getPathListFromDirectory(dir)
        console.log(`Found ${this._filesCount} files and ${this._dirsCount} directories`)
    }

    findPathIndex(path: string): number {
        return this._filesList.findIndex(({ name }) => path.toLowerCase() === name.toLowerCase())
    }

    getPath(name: string): string {
        console.log('getPath', name, this._filesList)
        const i = this.findPathIndex(name)
        if (i >= 0) {
            const dir = this._dirsList[this._filesList[i].dir]
            console.log(`FileSystem_impl::getPath ${dir}/${this._filesList[i].name}`)
            return `${dir}/${this._filesList[i].name}`
        }
    }

    addPath(dir: string, name: string): void {
        let index = this._dirsList.findIndex((dirPath) => dir === dirPath)
        if (index === -1) {
            this._dirsList.push(dir)
            index = this._dirsCount
            ++this._dirsCount
        }
        this._filesList.push({
            name,
            dir: index,
        })
        ++this._filesCount
    }

    async getPathListFromDirectory(dir: string): Promise<void> {
        console.log(`getPathListFromDirectory(${dir})`)
        try {
            const file = await FILE.fopen(`${dir}/files.json`, 'rb')
            console.log(file.toString())
            const files = JSON.parse(file.toString())
            console.log('files', files)
            files.forEach((filename: string) => this.addPath(dir, filename))
        } catch(e) {
            console.error(`error getting files from ${dir}/files.json`, e)
        }
    }
}

export class FileSystem {
    _impl: FileSystem_impl
    constructor(dataPath?: string) {
        if (typeof dataPath !== 'undefined') {
            throw 'should call setRootDirectory!'
        }
        this._impl = new FileSystem_impl()
    }

    async setRootDirectory(dataPath: string) {
        await this._impl.setRootDirectory(dataPath)
    }

    findPath(filename: string): string {
        return this._impl.getPath(filename)
    }

    exists(filename: string): boolean {
        return (this._impl.findPathIndex(filename) >= 0)
    }
}
