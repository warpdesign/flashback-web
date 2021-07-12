import { Game } from "./game"

enum ResourceType {
    kResourceTypeAmiga,
    kResourceTypeDOS,
    kResourceTypeMac,
}

enum Language {
	LANG_FR,
	LANG_EN,
	LANG_DE,
	LANG_SP,
	LANG_IT,
	LANG_JP,
}

enum WidescreenMode {
	kWidescreenNone,
	kWidescreenAdjacentRooms,
	kWidescreenMirrorRoom,
	kWidescreenBlur,
}

const Skill = {
    kSkillEasy: 0,
    kSkillNormal: 1,
    kSkillExpert: 2,
}

interface Options {
    bypass_protection: boolean
    enable_password_menu: boolean
    enable_language_selection: boolean
    fade_out_palette: boolean
    use_tile_data: boolean
    use_text_cutscenes: boolean
    use_seq_cutscenes: boolean
    use_words_protection: boolean
    use_white_tshirt: boolean
    play_asc_cutscene: boolean
    play_caillou_cutscene: boolean
    play_metro_cutscene: boolean
    play_serrure_cutscene: boolean
    play_carte_cutscene: boolean
    play_gamesaved_sound: boolean
}

interface Color {
    r: number
    g: number
    b: number
}

interface Point {
    x: number
    y: number
}

interface Demo {
    name: string
    level: number
    room: number
    x: number
    y: number
}

interface Level {
    name: string
    name2: string
    nameAmiga: string
    cutscene_id: number
    sound: number
    track: number
}

interface InitPGE {
    type: number
    pos_x: number
    pos_y: number
    obj_node_number: number
    life: number
    counter_values: number[]
    object_type: number
    init_room: number
    room_location: number
    init_flags: number
    colliding_icon_num: number
    icon_num: number
    object_id: number
    skill: number
    mirror_x: number
    flags: number
    unk1C: number
    text_num: number
}

const CreateInitPGE = () => ({
    type: 0,
    pos_x: 0,
    pos_y: 0,
    obj_node_number: 0,
    life: 0,
    counter_values: [],
    object_type: 0,
    init_room: 0,
    room_location: 0,
    init_flags: 0,
    colliding_icon_num: 0,
    icon_num: 0,
    object_id: 0,
    skill: 0,
    mirror_x: 0,
    flags: 0,
    unk1C: 0,
    text_num: 0
})

const CreatePGE = () => ({
    obj_type: 0,
    pos_x: 0,
    pos_y: 0,
    anim_seq: 0,
    room_location: 0,
    life: 0,
    counter_value: 0,
    collision_slot: 0,
    next_inventory_PGE: 0,
    current_inventory_PGE: 0,
    unkF: 0,
    anim_number: 0,
    flags: 0,
    index: 0,
    first_obj_number: 0,
    next_PGE_in_room: null,
    init_PGE: null,
})

const createLivePGE = () => ({
    obj_type: 0,
    pos_x: 0,
    pos_y: 0,
    anim_seq: 0,
    room_location: 0,
    life: 0,
    counter_value: 0,
    collision_slot: 0,
    next_inventory_PGE: 0,
    current_inventory_PGE: 0,
    unkF: 0,
    anim_number: 0,
    flags: 0,
    index: 0,
    first_obj_number: 0,
    next_PGE_in_room: null,
    init_PGE: null
})

interface LivePGE {
    obj_type: number
    pos_x: number
    pos_y: number
    anim_seq: number
    room_location: number
    life: number
    counter_value: number
    collision_slot: number
    next_inventory_PGE: number
    current_inventory_PGE: number
    unkF: number
    anim_number: number
    flags: number
    index: number
    first_obj_number: number
    next_PGE_in_room: LivePGE
    init_PGE: InitPGE
}

interface GroupPGE {
    next_entry: GroupPGE
    index: number
    group_id: number
}

const CreateObj = () => ({
    type: 0,
    dx: 0,
    dy: 0,
    init_obj_type: 0,
    opcode1: 0,
    opcode2: 0,
    flags: 0,
    opcode3: 0,
    init_obj_number: 0,
    opcode_arg1: 0,
    opcode_arg2: 0,
    opcode_arg3: 0
})

interface Obj {
    type: number
    dx: number
    dy: number
    init_obj_type: number
    opcode1: number
    opcode2: number
    flags: number
    opcode3: number
    init_obj_number: number
    opcode_arg1: number
    opcode_arg2: number
    opcode_arg3: number
}

interface ObjectNode {
    last_obj_number: number
    objects: Obj[]
    num_objects: number
}

interface ObjectOpcodeArgs {
    pge: LivePGE
    a: number
    b: number
}

interface AnimBufferState {
    x: number
    y: number
    w: number
    h: number
    dataPtr: Uint8Array
    pge: LivePGE
}

type pge_OpcodeProc = (args: ObjectOpcodeArgs, game: Game) => number
type pge_ZOrderCallback = (livePGE1: LivePGE, livePGE2: LivePGE, p1: number, p2: number, game: Game) => number

class AnimBuffers {
    _states: Array<AnimBufferState[]> = [null, null, null, null]
    _curPos: number[] = [0, 0, 0, 0]

    addState(stateNum: number, x: number, y: number, dataPtr: Uint8Array, pge: LivePGE, w: number = 0, h: number = 0) {
        if (stateNum >= 4) {
            throw(`Assertion failed: ${stateNum} < 4`)
        }
        const curPos = this._curPos[stateNum]
        const index = curPos === 0xFF ? 0 : curPos + 1
        const state: AnimBufferState = this._states[stateNum][index]
        state.x = x
        state.y = y
        state.w = w
        state.h = h
        state.dataPtr = dataPtr
        state.pge = pge
        this._curPos[stateNum] = (this._curPos[stateNum] + 1) % 256
    }
}

interface CollisionSlot {
    ct_pos: number
    prev_slot: CollisionSlot
    live_pge: LivePGE
    index: number
}

interface BankSlot {
    entryNum: number
    ptr: Uint8Array
}

interface CollisionSlot2 {
    next_slot: CollisionSlot2
    unk2: Int8Array
    data_size: number
    data_buf: Uint8Array
}

interface InventoryItem {
    icon_num: number
    init_pge: InitPGE
    live_pge: LivePGE
}

interface SoundFx {
    offset: number
    len: number
    freq: number
    data: Uint8Array
    peak: number
}

const READ_BE_UINT16 = (ptr: ArrayBuffer|Buffer|Uint8Array, offset = 0): number => {
    if (ptr instanceof Uint8Array) {
        return (ptr[offset] << 8) | ptr[1 + offset]
    }
    const b = ptr instanceof Buffer ? new DataView(ptr.buffer, ptr.offset + offset) : new DataView(ptr, offset)
	return (b.getUint8(0) << 8) | b.getUint8(1)
}

const READ_BE_UINT32 = (ptr: ArrayBuffer|Buffer|Uint8Array, offset = 0): number => {
    if (ptr instanceof Uint8Array) {
        return ((ptr[offset] << 24) | (ptr[1 + offset] << 16) | (ptr[2 + offset] << 8) | ptr[3 + offset]) >>> 0
    }
    const b = ptr instanceof Buffer ? new DataView(ptr.buffer, ptr.offset + offset) : new DataView(ptr, offset)
	return ((b.getUint8(0) << 24) | (b.getUint8(1) << 16) | (b.getUint8(2) << 8) | b.getUint8(3)) >>> 0
}

const READ_LE_UINT16 = (ptr: ArrayBuffer|Buffer|Uint8Array, offset = 0): number => {
    if (ptr instanceof Uint8Array) {
        return (ptr[1 + offset] << 8) | ptr[offset]
    }
	const b = ptr instanceof Buffer ? new DataView(ptr.buffer, ptr.offset + offset) : new DataView(ptr, offset)
	return (b.getUint8(1) << 8) | b.getUint8(0)
}

const READ_LE_UINT32 = (ptr: ArrayBuffer|Buffer|Uint8Array, offset = 0): number => {
    if (ptr instanceof Uint8Array) {
        return ((ptr[3 + offset] << 24) | (ptr[2 + offset] << 16) | (ptr[1 + offset] << 8) | ptr[offset]) >>> 0
    }
	const b = ptr instanceof Buffer ? new DataView(ptr.buffer, ptr.offset + offset) : new DataView(ptr, offset)
	return ((b.getUint8(3) << 24) | (b.getUint8(2) << 16) | (b.getUint8(1) << 8) | b.getUint8(0)) >>> 0
}

const ADDC_S16 = (a: number, b: number) => {
	a += b
	if (a < -32768) {
		a = -32768
	} else if (a > 32767) {
		a = 32767
	}
	return a
}

const S8_to_S16 = (a: number) => {
	if (a < -128) {
		return -32768
	} else if (a > 127) {
		return 32767
	} else {
		const u8 = (a ^ 0x80)
		return ((u8 << 8) | u8) - 32768
	}
}

const ARRAYSIZE = (ptr: Array<any>) => ptr.length

const CLIP = (val: number, a: number, b: number) => {
    if (val < a) {
        return a
    } else if (val > b) {
        return b
    }
    return val
}

class Buffer {
    offset: number
    buffer: ArrayBuffer

    constructor(buffer: ArrayBuffer, off = 0) {
        this.buffer = buffer
        this.offset = off
    }

    from(offset: number) {
        const buf = new Buffer(this.buffer, offset + this.offset)
        return buf
    }

    getUint8Array() {
        return new Uint8Array(this.buffer, this.offset)
    }
}

export { CreateObj, CreatePGE, CreateInitPGE, createLivePGE, ResourceType, Language, Options, WidescreenMode, Skill, Color, Point, Demo, Level, InitPGE, LivePGE, GroupPGE, Obj, ObjectNode, ObjectOpcodeArgs, AnimBufferState, AnimBuffers, CollisionSlot, CollisionSlot2, BankSlot, InventoryItem, SoundFx, READ_BE_UINT16, READ_BE_UINT32, READ_LE_UINT16, READ_LE_UINT32, ARRAYSIZE, CLIP, Buffer, ADDC_S16, S8_to_S16 }
export type { pge_OpcodeProc, pge_ZOrderCallback }