import { Buffer } from "./intern"

const dump = (ptr: ArrayBuffer|Buffer, name: string, len: number, lines = 30) => {
    let str = name + "\n"
    const data = ptr instanceof Buffer ? new Uint8Array(ptr.buffer, ptr.offset) : new Uint8Array(ptr)
    for (let i = 0; i < lines; ++i) {
        str += data[i] + " "
        if (i && !(i%10)) {
            str += "\n"
        }
    }
    str += '\n...\n'
    for (let i = len - lines; i < len; ++i) {
        str += data[i] + " "
        if (i && !(i%10)) {
            str += "\n"
        }
    }
    str += "\n==="
    console.log(str)
}

export { dump }
