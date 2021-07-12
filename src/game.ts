import { Demo, Level, ObjectOpcodeArgs, LivePGE, AnimBufferState, AnimBuffers, WidescreenMode, ResourceType, Language, Skill, Obj, ObjectNode, GroupPGE, CollisionSlot, CollisionSlot2, InventoryItem, InitPGE, Color, SoundFx, READ_BE_UINT16, READ_LE_UINT32, READ_BE_UINT32, CreatePGE, createLivePGE, Buffer } from './intern'
import type { pge_ZOrderCallback, pge_OpcodeProc } from './intern'
import { Cutscene } from './cutscene'
import { MAX_VOLUME, Mixer } from './mixer'
import { Resource, ObjectType, LocaleData } from './resource'
import { SeqPlayer } from './seq_player'
import { Video } from './video'
import { defaultScaleParameters, DF_FASTMODE, DF_SETLIFE, DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, SystemStub } from './systemstub_web'
import { FileSystem } from './fs'
import { Menu } from './menu'
import { scoreTable, _demoInputs, _gameLevels, _monsterListLevel1, _monsterListLevel2, _monsterListLevel3, _monsterListLevel4_1, _monsterListLevel4_2, _monsterListLevel5_1, _monsterListLevel5_2, _monsterListLevels, _monsterNames, _monsterPals, _pge_modKeysTable, _protectionCodeData, _protectionCodeDataAmiga, _protectionNumberDataAmiga, _protectionPal, _protectionWordData } from './staticres'
import { g_options } from './config'
import { File } from './file'
import { dump } from './util'
import { _pge_opcodeTable } from './game_opcodes'

const kIngameSaveSlot = 0
const kRewindSize = 120 // 10mins (~2MB)
const kAutoSaveSlot = 255
const kAutoSaveIntervalMs = 5 * 1000

const CT_UP_ROOM    = 0x00
const CT_DOWN_ROOM  = 0x40
const CT_RIGHT_ROOM = 0x80
const CT_LEFT_ROOM  = 0xC0

type col_Callback1 = (livePGE1: LivePGE, livePGE2: LivePGE, p1: number, p2: number, game: Game) => number
type col_Callback2 = (livePGE: LivePGE, p1: number, p2: number, p3: number, game: Game) => number

class Game {
    static _demoInputs: Demo[] = _demoInputs
    static _gameLevels: Level[] = _gameLevels
    static _scoreTable: Uint16Array = scoreTable
    static _monsterListLevel1: Uint8Array = _monsterListLevel1
    static _monsterListLevel2: Uint8Array = _monsterListLevel2
    static _monsterListLevel3: Uint8Array = _monsterListLevel3
    static _monsterListLevel4_1: Uint8Array = _monsterListLevel4_1
    static _monsterListLevel4_2: Uint8Array = _monsterListLevel4_2
    static _monsterListLevel5_1: Uint8Array = _monsterListLevel5_1
    static _monsterListLevel5_2: Uint8Array = _monsterListLevel5_2
    static _monsterListLevels: Uint8Array[] = _monsterListLevels
    static _monsterPals: Uint8Array[] = _monsterPals
    static _monsterNames: string[][] = _monsterNames
    _pge_opcodeTable: pge_OpcodeProc[] = _pge_opcodeTable
    static _pge_modKeysTable: Uint8Array = _pge_modKeysTable
    static _protectionCodeData: Uint8Array = _protectionCodeData
    static _protectionWordData: Uint8Array = _protectionWordData
    static _protectionNumberDataAmiga: Uint8Array = _protectionNumberDataAmiga
    static _protectionCodeDataAmiga: Uint8Array = _protectionCodeDataAmiga
    static _protectionPal: Uint8Array = _protectionPal

    _cut: Cutscene
    _menu: Menu
    _mix: Mixer
    _res: Resource
    _seq: SeqPlayer
    _vid: Video
    _stub: SystemStub
    _fs: FileSystem
    _savePath: string
    _rewindBuffer: File[]
    _rewindPtr: number
    _rewindLen: number

    _stringsTable: Uint8Array
    _textsTable: string[]
    _currentLevel: number
    _skillLevel: number
    _demoBin: number
    _score: number
    _currentRoom: number
    _currentIcon: number
    _loadMap: boolean
    _printLevelCodeCounter: number
    _randSeed: number
    _currentInventoryIconNum: number
    _curMonsterFrame: number
    _curMonsterNum: number
    _blinkingConradCounter: number
    _textToDisplay: number
    _eraseBackground: boolean
    _animBuffer0State: AnimBufferState[] = new Array(41).fill(null).map(() => ({
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        dataPtr: null,
        pge: null,
    }))
    _animBuffer1State: AnimBufferState[]  = new Array(6).fill(null).map(() => ({
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        dataPtr: null,
        pge: null,
    }))
    _animBuffer2State: AnimBufferState[]  = new Array(42).fill(null).map(() => ({
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        dataPtr: null,
        pge: null,
    }))
    _animBuffer3State: AnimBufferState[] = new Array(12).fill(null).map(() => ({
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        dataPtr: null,
        pge: null,
    }))
    _animBuffers: AnimBuffers = new AnimBuffers()
    _deathCutsceneCounter: number
    _saveStateCompleted: boolean
    _endLoop: boolean
    _frameTimestamp: number
    _widescreenMode: WidescreenMode
    _autoSave: boolean
    _saveTimestamp: number

    _stateSlot: number
    _validSaveState: boolean

    _inp_lastKeysHit: number
    _inp_lastKeysHitLeftRight: number
    _inp_demPos: number

    _pge_playAnimSound: boolean
    _pgeLive = new Array<LivePGE>(256).fill(null).map(() => createLivePGE())
    _pge_liveTable1 = new Array<LivePGE>(256)
    _pge_liveTable2 = new Array<LivePGE>(256)
    _pge_groups = new Array<GroupPGE>(256).fill(null).map(() => ({
        next_entry: null,
        index: 0,
        group_id: 0,
    }))
    _pge_groupsTable = new Array<GroupPGE>(256)
    _pge_nextFreeGroup: GroupPGE

	_pge_currentPiegeRoom: number
	_pge_currentPiegeFacingDir: boolean // (false == left)
	_pge_processOBJ: boolean
	_pge_inpKeysMask: number
	_pge_opTempVar1: number
	_pge_opTempVar2: number
	_pge_compareVar1: number
	_pge_compareVar2: number

    _col_curPos: number
    _col_curSlot: CollisionSlot
    _col_slotsTable: CollisionSlot[] = new Array(256)
    _col_slots: CollisionSlot[] = new Array(256).fill(null).map(() => ({
        ct_pos: 0,
        prev_slot: null,
        live_pge: null,
        index: 0      
    }))
	_col_slots2: CollisionSlot2[] = new Array(256).fill(null).map(() => ({
        next_slot: null,
        unk2: null,
        data_size: 0,
        data_buf: new Uint8Array(0x10)
    }))
	_col_slots2Cur: CollisionSlot2
	_col_slots2Next: CollisionSlot2
    _col_activeCollisionSlots: Uint8Array = new Uint8Array(0x30 * 3)
	_col_currentLeftRoom: number
	_col_currentRightRoom: number
	_col_currentPiegeGridPosX: number
	_col_currentPiegeGridPosY: number
    renders: number
    debugStartFrame: number

    constructor(stub: SystemStub, fs: FileSystem, savePath: string, level: number, ver: ResourceType, lang: Language, widescreenMode: WidescreenMode, autoSave: boolean) {
        this._res = new Resource(fs, ver, lang)
        this._vid = new Video(this._res, stub, widescreenMode)
        this._cut = new Cutscene(this._res, stub, this._vid)
        this._menu = new Menu(this._res, stub, this._vid)
        this._mix = new Mixer(fs, stub)
        this._seq = new SeqPlayer(stub, this._mix)
        this._stub = stub
        this._fs = fs
        this._savePath = savePath
        this._stateSlot = 1
        this._inp_demPos = 0
        this._skillLevel = this._menu._skill = Skill.kSkillNormal
        this._currentLevel = this._menu._level = level
        this._demoBin = -1
        this._widescreenMode = widescreenMode
        this._autoSave = autoSave
        this._rewindPtr = -1
        this._rewindLen = 0
    }

    pge_loadForCurrentLevel(idx: number) {
        const live_pge: LivePGE = this._pgeLive[idx]
        const init_pge: InitPGE = this._res._pgeInit[idx]
    
        live_pge.init_PGE = init_pge;
        live_pge.obj_type = init_pge.type
        live_pge.pos_x = init_pge.pos_x
        live_pge.pos_y = init_pge.pos_y
        live_pge.anim_seq = 0
        live_pge.room_location = init_pge.init_room
    
        live_pge.life = init_pge.life
        if (this._skillLevel >= 2 && init_pge.object_type === 10) {
            live_pge.life *= 2
        }
        live_pge.counter_value = 0
        live_pge.collision_slot = 0xFF
        live_pge.next_inventory_PGE = 0xFF
        live_pge.current_inventory_PGE = 0xFF
        live_pge.unkF = 0xFF
        live_pge.anim_number = 0
        live_pge.index = idx
        live_pge.next_PGE_in_room = null
    
        let flags = 0
        if (init_pge.skill <= this._skillLevel) {
            if (init_pge.room_location !== 0 || ((init_pge.flags & 4) && (this._currentRoom === init_pge.init_room))) {
                flags |= 4
                this._pge_liveTable2[idx] = live_pge
            }
            if (init_pge.mirror_x !== 0) {
                flags |= 1
            }
            if (init_pge.init_flags & 8) {
                flags |= 0x10
            }
            flags |= (init_pge.init_flags & 3) << 5
            if (init_pge.flags & 2) {
                flags |= 0x80
            }
            live_pge.flags = flags
            if (init_pge.obj_node_number >= this._res._numObjectNodes) {
                throw(`Assertion failed: ${init_pge.obj_node_number} < ${this._res._numObjectNodes}}`)
            }
            const on:ObjectNode = this._res._objectNodesMap[init_pge.obj_node_number]
            let obj = 0
            let i = 0
            while (on.objects[obj].type !== live_pge.obj_type) {
                ++i
                ++obj
            }
            if (i >= on.num_objects) {
                throw(`Assertion failed: ${i} < ${on.num_objects}`)
            }
            live_pge.first_obj_number = i
            this.pge_setupDefaultAnim(live_pge)
        }
    }

    pge_setupDefaultAnim(pge: LivePGE) {
        const anim_data = this._res.getAniData(pge.obj_type)
        if (pge.anim_seq < this._res._readUint16(anim_data)) {
            pge.anim_seq = 0
        }
        const anim_frame = anim_data.subarray(6 + pge.anim_seq * 4)
        if (this._res._readUint16(anim_frame) !== 0xFFFF) {
            let f = this._res._readUint16(anim_data)
            if (pge.flags & 1) {
                f ^= 0x8000
            }
            pge.flags &= ~2
            if (f & 0x8000) {
                pge.flags |= 2
            }
            pge.flags &= ~8
            if (this._res._readUint16(anim_data, 4) & 0xFFFF) {
                pge.flags |= 8
            }

            pge.anim_number = this._res._readUint16(anim_frame) & 0x7FFF
        }
    }

    handleProtectionScreenShape() {
        throw('handleProtectionScreenShape not implemented!')
        return true
    }

    displayTitleScreenMac(num: number) {
        throw('displayTitleScreenMac not implemented!')
    }
    
    displayTitleScreenAmiga() {
        throw('displayTitleScreenAmigz not implemented!')
    }

    async playCutscene(id: number = -1) {
        if (id !== -1) {
            this._cut._id = id
        }
        if (this._cut._id !== -1) {
            if (this._stub.hasWidescreen()) {
                this._stub.enableWidescreen(false)
            }
            this._mix.stopMusic()

            if (this._res._hasSeqData) {
                debugger
                let num = 0
                switch (this._cut._id) {
                case 0x02: {
                        const tab = [ 1, 2, 1, 3, 3, 4, 4 ]
                        num = tab[this._currentLevel]
                    }
                    break
                case 0x05: {
                        const tab = [ 1, 2, 3, 5, 5, 4, 4 ]
                        num = tab[this._currentLevel]
                    }
                    break
                case 0x0A: {
                        const tab = [ 1, 2, 2, 2, 2, 2, 2 ]
                        num = tab[this._currentLevel]
                    }
                    break
                case 0x10: {
                        const tab = [ 1, 1, 1, 2, 2, 3, 3 ]
                        num = tab[this._currentLevel]
                    }
                    break
                case 0x3C: {
                        const tab = [ 1, 1, 1, 1, 1, 2, 2 ]
                        num = tab[this._currentLevel]
                    }
                    break
                case 0x40:
                    console.log("Hooo doing nothing!")
                    return
                case 0x4A:
                    return
                }
                if (SeqPlayer._namesTable[this._cut._id]) {
                    let name = SeqPlayer._namesTable[this._cut._id] + ".SEQ"
                    if (name.match(/0/)) {
                        name += num
                    }
                    if (await this.playCutsceneSeq(name)) {
                        if (this._cut._id === 0x3D) {
                            await this.playCutsceneSeq("CREDITS.SEQ")
                            this._cut._interrupted = false
                        } else {
                            this._cut._id = 0xFFFF
                        }
                        return
                    }
                }
            }
            if (this._cut._id !== 0x4A) {
                this._mix.playMusic(Cutscene._musicTable[this._cut._id])
            }
            await this._cut.play()
            if (id === 0xD && !this._cut._interrupted) {
                const extendedIntroduction = (this._res._type === ResourceType.kResourceTypeDOS || this._res._type === ResourceType.kResourceTypeMac)
                if (extendedIntroduction) {
                    this._cut._id = 0x4A
                    await this._cut.play()
                }
            }

            if (this._res._type === ResourceType.kResourceTypeMac && !(id === 0x48 || id === 0x49)) { // continue or score screens
                // restore palette entries modified by the cutscene player (0xC and 0xD)
                const palette:Color[] = new Array(32)
                this._res.MAC_copyClut16(palette, 0, 0x37)
                this._res.MAC_copyClut16(palette, 1, 0x38)
                for (let i = 0; i < 32; ++i) {
                    this._stub.setPaletteEntry(0xC0 + i, palette[i])
                }
            }    
            if (id === 0x3D) {
                await this._cut.playCredits()
            }  
            this._mix.stopMusic()
            if (this._stub.hasWidescreen()) {
                this._stub.enableWidescreen(true)
            }            
        }
    }

    handleProtectionScreenWords() {
        return true
    }

    async runLoop() {
        await this.mainLoop()
        if (this._demoBin !== -1 && this._inp_demPos >= this._res._demLen) {
            // exit level
            this._demoBin = -1
            this._endLoop = true
        }
        if (!this._stub._pi.quit && !this._endLoop) {
            requestAnimationFrame(() => this.runLoop())
        } else {
            this.renderDone()
        }
    }

    async run() {
        this._randSeed = new Date().getTime()
        await this._res.init()
        this._res.load_TEXT()

        switch(this._res._type) {
            case ResourceType.kResourceTypeAmiga:
                await this._res.load("FONT8", ObjectType.OT_FNT)
                if (this._res._isDemo) {
                    this._cut._patchedOffsetsTable = Cutscene._amigaDemoOffsetsTable
                }
                break
            case ResourceType.kResourceTypeDOS:
                await this._res.load("FB_TXT", ObjectType.OT_FNT)
                if (g_options.use_seq_cutscenes) {
                    this._res._hasSeqData = this._fs.exists("INTRO.SEQ")
                }
                if (this._fs.exists("logosssi.cmd")) {
                    this._cut._patchedOffsetsTable = Cutscene._ssiOffsetsTable
                }
                break
            case ResourceType.kResourceTypeMac:
                await this._res.MAC_loadClutData()
                await this._res.MAC_loadFontData()
                break

            default:
                break
        }

        if (!g_options.bypass_protection && !g_options.use_words_protection && !this._res.isMac()) {
            while (!this.handleProtectionScreenShape()) {
                if (this._stub._pi.quit) {
                    return;
                }
            }
        }

        this._mix.init()
        this._mix._mod._isAmiga = this._res.isAmiga()

        if (this._res.isMac()) {
            this.displayTitleScreenMac(Menu.kMacTitleScreen_MacPlay)
            if (!this._stub._pi.quit) {
                this.displayTitleScreenMac(Menu.kMacTitleScreen_Presage)
            }
        }

        await this.playCutscene(0x40)
        await this.playCutscene(0x0D)

        switch (this._res._type) {
            case ResourceType.kResourceTypeAmiga:
                await this._res.load("ICONE", ObjectType.OT_ICN, "SPR")
                await this._res.load("ICON", ObjectType.OT_ICN, "SPR")
                await this._res.load("PERSO", ObjectType.OT_SPM)
                break;
            case ResourceType.kResourceTypeDOS:
                await this._res.load("GLOBAL", ObjectType.OT_ICN)
                await this._res.load("GLOBAL", ObjectType.OT_SPC)
                await this._res.load("PERSO", ObjectType.OT_SPR)
                await this._res.load_SPR_OFF("PERSO", this._res._spr1)
                await this._res.load_FIB("GLOBAL")
                break
            case ResourceType.kResourceTypeMac:
                // TODO
                debugger
                // await this._res.MAC_loadIconData()
                // await this._res.MAC_loadPersoData()
                // await this._res.MAC_loadSounds()
                break
            }

            if (!g_options.bypass_protection && g_options.use_words_protection && this._res.isDOS()) {
                // TODO
                while (!this.handleProtectionScreenWords()) {
                    if (this._stub._pi.quit) {
                        return
                    }
                }
            }

            const presentMenu = ((this._res._type != ResourceType.kResourceTypeDOS) || this._res.fileExists("MENU1.MAP"))

            while (!this._stub._pi.quit) {
                if (presentMenu) {
                    this._mix.playMusic(1)
                    switch (this._res._type) {
                    case ResourceType.kResourceTypeDOS:
                        await this._menu.handleTitleScreen()
                        if (this._menu._selectedOption == Menu.MENU_OPTION_ITEM_QUIT || this._stub._pi.quit) {
                            this._stub._pi.quit = true
                            break
                        }
                        if (this._menu._selectedOption === Menu.MENU_OPTION_ITEM_DEMO) {
                            this._demoBin = (this._demoBin + 1) % Game._demoInputs.length
                            const fn = Game._demoInputs[this._demoBin].name

                            await this._res.load_DEM(fn)

                            if (this._res._demLen === 0) {
                                continue
                            }

                            this._skillLevel = Skill.kSkillNormal
                            this._currentLevel = Game._demoInputs[this._demoBin].level
                            this._randSeed = 0

                            this._mix.stopMusic()
                            break
                        }
                        this._demoBin = -1
                        this._skillLevel = this._menu._skill
                        this._currentLevel = this._menu._level
                        this._mix.stopMusic()

                        break
                    case ResourceType.kResourceTypeAmiga:
                        debugger
                        this.displayTitleScreenAmiga()
                        this._stub.setScreenSize(Video.GAMESCREEN_W, Video.GAMESCREEN_H)
                        break
                    case ResourceType.kResourceTypeMac:
                        this.displayTitleScreenMac(Menu.kMacTitleScreen_Flashback)
                        break
                    }
                }

                if (this._stub._pi.quit) {
                    break
                }
                if (this._stub.hasWidescreen()) {
                    this._stub.clearWidescreen()
                }

                if (this._currentLevel === 7) {
                    await this._vid.fadeOut()
                    this._vid.setTextPalette()
                    await this.playCutscene(0x3D)
                } else {
                    this._vid.setTextPalette()
                    this._vid.setPalette0xF()
                    this._stub.setOverscanColor(0xE0)
                    this._vid._unkPalSlot1 = 0
                    this._vid._unkPalSlot2 = 0
                    this._score = 0
                    this.clearStateRewind()
                    await this.loadLevelData()

                    this.resetGameState()
                    this._endLoop = false
                    this._frameTimestamp = this._stub.getTimeStamp()
                    this._saveTimestamp = this._frameTimestamp
                    this.renders = 0
                    this.debugStartFrame = 10650
                    this.renderPromise = new Promise((resolve) => {
                        this.renderDone = resolve
                    })
                    new Promise(() => requestAnimationFrame(() => this.runLoop()))
                    await this.renderPromise

                    // flush inputs
                    this._stub._pi.dirMask = 0
                    this._stub._pi.enter = false
                    this._stub._pi.space = false
                    this._stub._pi.shift = false
                }
            }
    }

    async showFinalScore() {
        if (this._stub.hasWidescreen()) {
            this._stub.clearWidescreen()
        }
        await this.playCutscene(0x49)

        const buf = this._score.toString().padStart(8, '0')
        this._vid.drawString(buf, (Video.GAMESCREEN_W - buf.length * Video.CHAR_W) / 2, 40, 0xE5)
        const str = this._menu.getLevelPassword(7, this._skillLevel)
        this._vid.drawString(str, (Video.GAMESCREEN_W - str.length * Video.CHAR_W) / 2, 16, 0xE7)
        while (!this._stub._pi.quit) {
            this._stub.copyRect(0, 0, this._vid._w, this._vid._h, this._vid._frontLayer, this._vid._w)
            await this._stub.updateScreen(0)
            this._stub.processEvents()
            if (this._stub._pi.enter) {
                this._stub._pi.enter = false
                break
            }
            this._stub.sleep(100)
        }
    }

    pge_removeFromGroup(idx: number) {
        let le: GroupPGE = this._pge_groupsTable[idx]
        if (le) {
            this._pge_groupsTable[idx] = null
            let next: GroupPGE = this._pge_nextFreeGroup
            while (le) {
                const cur: GroupPGE = le.next_entry
                le.next_entry = next
                le.index = 0
                le.group_id = 0
                next = le
                le = cur
            }
            this._pge_nextFreeGroup = next
        }
    }

    pge_execute(live_pge: LivePGE, init_pge: InitPGE, obj: Obj) {
        let op: pge_OpcodeProc
        let args: ObjectOpcodeArgs = {
            pge: null,
            a: 0,
            b: 0,
        }
        if (obj.opcode1) {
            args.pge = live_pge
            args.a = obj.opcode_arg1
            args.b = 0
            this.renders > this.debugStartFrame && console.log(`pge_execute op1=0x${obj.opcode1.toString(16)}`)
            op = this._pge_opcodeTable[obj.opcode1]
            if (!op) {
                debugger
                throw(`Game::pge_execute() missing call to pge_opcode 0x${obj.opcode1.toString(16)}`)
                return 0
            }
            if (!(op(args, this) & 0xFF))
                 return 0
        }
        if (obj.opcode2) {
            args.pge = live_pge
            args.a = obj.opcode_arg2
            args.b = obj.opcode_arg1
            this.renders > this.debugStartFrame && console.log(`pge_execute op2=0x${obj.opcode2.toString(16)}`)
            let op = this._pge_opcodeTable[obj.opcode2]
            if (!op) {
                debugger
                console.warn(`Game::pge_execute() missing call to pge_opcode 0x${obj.opcode2.toString(16)}`)
                return 0
            }
            if (!(op(args, this) & 0xFF))
                return 0
        }
        if (obj.opcode3) {
            args.pge = live_pge
            args.a = obj.opcode_arg3
            args.b = 0
            this.renders > this.debugStartFrame && console.log(`pge_execute op3=0x${obj.opcode3.toString(16)}`)
            op = this._pge_opcodeTable[obj.opcode3]
            if (op) {
                op(args, this)
            } else {
                debugger
                console.warn(`Game::pge_execute() missing call to pge_opcode 0x${obj.opcode3.toString(16)}`)
            }
        }
        live_pge.obj_type = obj.init_obj_type
        live_pge.first_obj_number = obj.init_obj_number
        live_pge.anim_seq = 0
        if (obj.flags & 0xF0) {
            this._score += Game._scoreTable[obj.flags >> 4]
        }
        if (obj.flags & 1) {
            live_pge.flags ^= 1
        }
        if (obj.flags & 2) {
            --live_pge.life
            if (init_pge.object_type === 1) {
                this._pge_processOBJ = true
            } else if (init_pge.object_type === 10) {
                this._score += 100
            }
        }
        if (obj.flags & 4) {
            ++live_pge.life
        }
        if (obj.flags & 8) {
            live_pge.life = -1
        }
    
        if (live_pge.flags & 1) {
            live_pge.pos_x -= obj.dx
        } else {
            live_pge.pos_x += obj.dx
        }
        live_pge.pos_y += obj.dy
    
        if (this._pge_processOBJ) {
            if (init_pge.object_type === 1) {
                if (this.pge_processOBJ(live_pge) !== 0) {
                    this._blinkingConradCounter = 60
                    this._pge_processOBJ = false
                }
            }
        }
        return 0xFFFF
    }

    pge_processOBJ(pge: LivePGE) {
        const init_pge: InitPGE = pge.init_PGE
        if (init_pge.obj_node_number >= this._res._numObjectNodes) {
            throw(`Assertion failed: ${init_pge.obj_node_number} < ${this._res._numObjectNodes}`)
        }
        const on: ObjectNode = this._res._objectNodesMap[init_pge.obj_node_number]
        let objIndex = pge.first_obj_number
        let obj: Obj = on.objects[objIndex]
        let i = pge.first_obj_number
        while (i < on.last_obj_number && pge.obj_type === obj.type) {
            if (obj.opcode2 === 0x6B) return 0xFFFF
            if (obj.opcode2 === 0x22 && obj.opcode_arg2 <= 4) return 0xFFFF
    
            if (obj.opcode1 === 0x6B) return 0xFFFF
            if (obj.opcode1 === 0x22 && obj.opcode_arg1 <= 4) return 0xFFFF
    
            objIndex++
            obj = on.objects[objIndex]
            ++i
        }
        return 0;
    }

    pge_reorderInventory(pge: LivePGE) {
        if (pge.unkF !== 0xFF) {
            const _bx:LivePGE = this._pgeLive[pge.unkF]
            const _di:LivePGE = this.pge_getInventoryItemBefore(_bx, pge)
            if (_di === _bx) {
                if (_di.current_inventory_PGE === pge.index) {
                    this.pge_removeFromInventory(_di, pge, _bx)
                }
            } else {
                if (_di.next_inventory_PGE === pge.index) {
                    this.pge_removeFromInventory(_di, pge, _bx)
                }
            }
        }
    }

    pge_updateInventory(pge1: LivePGE, pge2: LivePGE) {
        if (pge2.unkF !== 0xFF) {
            this.pge_reorderInventory(pge2)
        }

        const _ax:LivePGE = this.pge_getInventoryItemBefore(pge1, null)
        this.pge_addToInventory(_ax, pge2, pge1)
    }

    pge_updateGroup(idx: number, unk1: number, unk2: number) {
        let pge: LivePGE = this._pgeLive[unk1]
        if (!(pge.flags & 4)) {
            if (!(pge.init_PGE.flags & 1)) {
                return
            }
            pge.flags |= 4
            this._pge_liveTable2[unk1] = pge
        }
        if (unk2 <= 4) {
            const pge_room = pge.room_location
            pge = this._pgeLive[idx]
            if (pge_room !== pge.room_location) {
                return
            }
            if (unk1 === 0 && this._blinkingConradCounter !== 0) {
                return
            }
            // XXX
        }
        const le: GroupPGE = this._pge_nextFreeGroup
        if (le) {
            // append to the list
            this._pge_nextFreeGroup = le.next_entry
            const _ax: GroupPGE = this._pge_groupsTable[unk1]
            this._pge_groupsTable[unk1] = le
            le.next_entry = _ax
            le.index = idx
            le.group_id = unk2
        }
    }

    pge_process(pge: LivePGE) {
        this._pge_playAnimSound = true;
        this._pge_currentPiegeFacingDir = (pge.flags & 1) !== 0
        this._pge_currentPiegeRoom = pge.room_location
        const le: GroupPGE = this._pge_groupsTable[pge.index]
        this.renders > this.debugStartFrame && console.log(`_pge_currentPiegeFacingDir=${this._pge_currentPiegeFacingDir} _pge_currentPiegeRoom=${this._pge_currentPiegeRoom} le=${le}`)
        if (le) {
            this.pge_setupNextAnimFrame(pge, le)
        }
        let anim_data = this._res.getAniData(pge.obj_type)
        this.renders > this.debugStartFrame && console.log(`read=${this._res._readUint16(anim_data)} anim_seq=${pge.anim_seq}`)
        if (this._res._readUint16(anim_data) <= pge.anim_seq) {
            this.renders > this.debugStartFrame && console.log('if')
            const init_pge:InitPGE = pge.init_PGE
            if (init_pge.obj_node_number >= this._res._numObjectNodes) {
                throw(`Assertion failed: ${init_pge.obj_node_number} < ${this._res._numObjectNodes}`)
            }
            let on: ObjectNode
            on = this._res._objectNodesMap[init_pge.obj_node_number]
            let objIndex = pge.first_obj_number
            let obj: Obj = on.objects[objIndex]
            let i = 0
            while (1) {
                this.renders > this.debugStartFrame && console.log(`** pge_process(${i++})`)
                if (obj.type !== pge.obj_type) {
                    this.renders > this.debugStartFrame && console.log('exiting pge_process loop: removing', pge.index)
                    this.pge_removeFromGroup(pge.index)
                    return
                }
                let _ax = this.pge_execute(pge, init_pge, obj)
                if (this._res.isDOS()) {
                    if (this._currentLevel === 6 && (this._currentRoom === 50 || this._currentRoom === 51)) {
                        if (pge.index === 79 && _ax === 0xFFFF && obj.opcode1 === 0x60 && obj.opcode2 === 0 && obj.opcode3 === 0) {
                            if (this.col_getGridPos(this._pgeLive[79], 0) === this.col_getGridPos(this._pgeLive[0], 0)) {
                                this.pge_updateGroup(79, 0, 4)
                            }
                        }
                    }
                }
                if (_ax !== 0) {
                    this.renders > this.debugStartFrame && console.log("exiting pge_process loop setup other pieges")
                    anim_data = this._res.getAniData(pge.obj_type)
                    const snd = anim_data[2]
                    if (snd) {
                        this.pge_playAnimSound(pge, snd)
                    }
                    this.pge_setupOtherPieges(pge, init_pge)
                    break
                }
                ++objIndex
                obj = on.objects[objIndex]
            }
        } else {
            this.renders > this.debugStartFrame && console.log('else')
        }
        this.pge_setupAnim(pge)
        ++pge.anim_seq
        this.pge_removeFromGroup(pge.index)
    }

    pge_setupAnim(pge: LivePGE) {
        const anim_data = this._res.getAniData(pge.obj_type)
        if (this._res._readUint16(anim_data) < pge.anim_seq) {
            pge.anim_seq = 0;
        }
        const anim_frame = anim_data.subarray(6 + pge.anim_seq * 4)

        if (this._res._readUint16(anim_frame) !== 0xFFFF) {
            let fl = this._res._readUint16(anim_frame)
            if (pge.flags & 1) {
                fl ^= 0x8000
                pge.pos_x = pge.pos_x - (anim_frame[2] << 24 >>24)
            } else {
                pge.pos_x = pge.pos_x + (anim_frame[2] << 24 >> 24)
            }
            pge.pos_y = pge.pos_y + (anim_frame[3] << 24 >> 24)
            pge.flags &= ~2
            if (fl & 0x8000) {
                pge.flags |= 2
            }
            pge.flags &= ~8
            if (this._res._readUint16(anim_data, 4) & 0xFFFF) {
                pge.flags |= 8
            }
            pge.anim_number = this._res._readUint16(anim_frame) & 0x7FFF
        }
    }

    pge_setupOtherPieges(pge: LivePGE, init_pge: InitPGE) {
        let room_ct_data:Int8Array = null
        if (pge.pos_x <= -10) {
            pge.pos_x += 256
            room_ct_data = this._res._ctData.subarray(CT_LEFT_ROOM)
        } else if (pge.pos_x >= 256) {
            pge.pos_x -= 256
            room_ct_data = this._res._ctData.subarray(CT_RIGHT_ROOM)
        } else if (pge.pos_y < 0) {
            pge.pos_y += 216
            room_ct_data = this._res._ctData.subarray(CT_UP_ROOM)
        } else if (pge.pos_y >= 216) {
            pge.pos_y -= 216
            room_ct_data = this._res._ctData.subarray(CT_DOWN_ROOM)
        }
        if (room_ct_data) {
            let room = pge.room_location << 24 >> 24
            if (room >= 0) {
                room = room_ct_data[room]
                pge.room_location = room
            }
            if (init_pge.object_type === 1) {
                this._currentRoom = room
                this.col_prepareRoomState()
                this._loadMap = true
                if (!(this._currentRoom & 0x80) && this._currentRoom < 0x40) {
                    let pge_it:LivePGE = this._pge_liveTable1[this._currentRoom]
                    while (pge_it) {
                        if (pge_it.init_PGE.flags & 4) {
                            this._pge_liveTable2[pge_it.index] = pge_it
                            pge_it.flags |= 4
                        }
                        pge_it = pge_it.next_PGE_in_room
                    }
                    room = this._res._ctData[CT_UP_ROOM + this._currentRoom]
                    if (room >= 0 && room < 0x40) {
                        pge_it = this._pge_liveTable1[room]
                        while (pge_it) {
                            if (pge_it.init_PGE.object_type !== 10 && pge_it.pos_y >= 48 && (pge_it.init_PGE.flags & 4)) {
                                this._pge_liveTable2[pge_it.index] = pge_it
                                pge_it.flags |= 4
                            }
                            pge_it = pge_it.next_PGE_in_room
                        }
                    }
                    room = this._res._ctData[CT_DOWN_ROOM + this._currentRoom]
                    if (room >= 0 && room < 0x40) {
                        pge_it = this._pge_liveTable1[room]
                        while (pge_it) {
                            if (pge_it.init_PGE.object_type !== 10 && pge_it.pos_y >= 176 && (pge_it.init_PGE.flags & 4)) {
                                this._pge_liveTable2[pge_it.index] = pge_it
                                pge_it.flags |= 4
                            }
                            pge_it = pge_it.next_PGE_in_room
                        }
                    }
                }
            }
        }
        this.pge_addToCurrentRoomList(pge, this._pge_currentPiegeRoom);
    }
    
    pge_addToCurrentRoomList(pge: LivePGE, room: number) {
        if (room !== pge.room_location) {
            let cur_pge: LivePGE = this._pge_liveTable1[room]
            let prev_pge: LivePGE = null
            while (cur_pge && cur_pge !== pge) {
                prev_pge = cur_pge
                cur_pge = cur_pge.next_PGE_in_room
            }
            if (cur_pge) {
                if (!prev_pge) {
                    this._pge_liveTable1[room] = pge.next_PGE_in_room
                } else {
                    prev_pge.next_PGE_in_room = cur_pge.next_PGE_in_room
                }
                const temp: LivePGE = this._pge_liveTable1[pge.room_location]
                pge.next_PGE_in_room = temp
                this._pge_liveTable1[pge.room_location] = pge
            }
        }
    }

    playSound(num: number, softVol: number) {
        if (num < this._res._numSfx) {
            const sfx: SoundFx = this._res._sfxList[num]
            if (sfx.data) {
                const volume = MAX_VOLUME >> (2 * softVol)
                this._mix.play(sfx.data, sfx.len, sfx.freq, volume)
            }
        } else if (num === 66) {
            // open/close inventory (DOS)
        } else if (num >= 68 && num <= 75) {
            // in-game music
            this._mix.playMusic(num);
        } else if (num == 77) {
            // triggered when Conrad reaches a platform
        } else {
            // console.warn(`Unknown sound num ${num}`)
        }
    }

    pge_playAnimSound(pge: LivePGE, arg2: number) {
        if ((pge.flags & 4) && this._pge_playAnimSound) {
            const sfxId = (arg2 & 0xFF) - 1
            if (this._currentRoom === pge.room_location) {
                this.playSound(sfxId, 0)
            } else {
                if (this._res._ctData[CT_DOWN_ROOM + this._currentRoom] === pge.room_location ||
                    this._res._ctData[CT_UP_ROOM + this._currentRoom] === pge.room_location ||
                    this._res._ctData[CT_RIGHT_ROOM + this._currentRoom] === pge.room_location ||
                    this._res._ctData[CT_LEFT_ROOM + this._currentRoom] === pge.room_location) {
                    this.playSound(sfxId, 1)
                }
            }
        }
    }

    pge_setupNextAnimFrame(pge: LivePGE, le: GroupPGE) {
        const init_pge: InitPGE = pge.init_PGE
        if (init_pge.obj_node_number >= this._res._numObjectNodes) {
            throw(`Assertion failed: ${init_pge.obj_node_number} < ${this._res._numObjectNodes}`)
        }

        const set_anim = () => {
            const anim_data = this._res.getAniData(pge.obj_type)
            let _dh = this._res._readUint16(anim_data) & 0x00FF
            let _dl = pge.anim_seq
            const anim_frame = anim_data.subarray(6 + _dl * 4)
            let index = 0
            while (_dh > _dl) {
                if (this._res._readUint16(anim_frame, index) != 0xFFFF) {
                    if (this._pge_currentPiegeFacingDir) {
                        pge.pos_x = pge.pos_x - (anim_frame[2 + index] << 24 >> 24)
                    } else {
                        pge.pos_x = pge.pos_x + (anim_frame[2 + index] << 24 >> 24)
                    }
                    pge.pos_y = pge.pos_y + (anim_frame[3 + index] << 24 >> 24)
                }
                index += 4
                ++_dl
            }
            pge.anim_seq = _dh
            this._col_currentPiegeGridPosY = (pge.pos_y / 36) & ~1
            this._col_currentPiegeGridPosX = (pge.pos_x + 8) >> 4
        }

        const on: ObjectNode = this._res._objectNodesMap[init_pge.obj_node_number]
        let onIndex = pge.first_obj_number
        let obj: Obj = on.objects[onIndex]
        let i = pge.first_obj_number

        while (i < on.last_obj_number && pge.obj_type === obj.type) {
            let next_le: GroupPGE = le
            while (next_le) {
                let groupId = next_le.group_id
                if (obj.opcode2 === 0x6B) { // pge_op_isInGroupSlice
                    if (obj.opcode_arg2 === 0) {
                        if (groupId === 1 || groupId === 2) {
                            set_anim()
                            return
                        }
                    }
                    if (obj.opcode_arg2 === 1) {
                        if (groupId === 3 || groupId === 4) {
                            set_anim()
                            return
                        }
                    }
                } else if (groupId === obj.opcode_arg2) {
                    if (obj.opcode2 === 0x22 || obj.opcode2 === 0x6F) {
                        set_anim()
                        return
                    }
                }
                if (obj.opcode1 === 0x6B) { // pge_op_isInGroupSlice
                    if (obj.opcode_arg1 === 0) {
                        if (groupId === 1 || groupId === 2) {
                            set_anim()
                            return
                        }
                    }
                    if (obj.opcode_arg1 === 1) {
                        if (groupId === 3 || groupId === 4) {
                            set_anim()
                            return
                        }
                    }
                } else if (groupId === obj.opcode_arg1) {
                    if (obj.opcode1 === 0x22 || obj.opcode1 === 0x6F) {
                        set_anim()
                        return
                    }
                }
                next_le = next_le.next_entry
            }
            ++onIndex
            obj = on.objects[onIndex]
            ++i
        }
        return
    }

    drawIcon(iconNum: number, x: number, y: number, colMask: number) {
        const buf = new Uint8Array(16 * 16)
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            if (iconNum > 30) {
                // inventory icons
                switch (iconNum) {
                case 76: // cursor
                    buf.fill(0)
                    for (let i = 0; i < 3; ++i) {
                        buf[i] = buf[15 * 16 + (15 - i)] = 1
                        buf[i * 16] = buf[(15 - i) * 16 + 15] = 1
                    }
                    break
                case 77: // up - icon.spr 4
                    buf.fill(0)
                    this._vid.AMIGA_decodeIcn(this._res._icn, 35, buf)
                    break
                case 78: // down - icon.spr 5
                    buf.fill(0)
                    this._vid.AMIGA_decodeIcn(this._res._icn, 36, buf)
                    break
                default:
                    buf.fill(5)
                    break
                }
            } else {
                this._vid.AMIGA_decodeIcn(this._res._icn, iconNum, buf)
            }
            break
        case ResourceType.kResourceTypeDOS:
            this._vid.PC_decodeIcn(this._res._icn, iconNum, buf)
            break
        case ResourceType.kResourceTypeMac:
            switch (iconNum) {
            case 76: // cursor
                iconNum = 32
                break
            case 77: // up
                iconNum = 33
                break
            case 78: // down
                iconNum = 34
                break
            }
            this._vid.MAC_drawSprite(x, y, this._res._icn, iconNum, false, true)
            return
        }
        this._vid.drawSpriteSub1(buf, this._vid._frontLayer.subarray(x + y * this._vid._w), 16, 16, 16, colMask << 4)
        this._vid.markBlockAsDirty(x, y, 16, 16, this._vid._layerScale)
    }

    drawCurrentInventoryItem() {
        const src = this._pgeLive[0].current_inventory_PGE
        if (src !== 0xFF) {
            this._currentIcon = this._res._pgeInit[src].icon_num
            this.drawIcon(this._currentIcon, 232, 8, 0xA);
        }
    }

    col_findPiege(pge: LivePGE, arg2: number) {
        if (pge.collision_slot !== 0xFF) {
            let slot:CollisionSlot = this._col_slotsTable[pge.collision_slot]
            while (slot) {
                if (slot.live_pge === pge) {
                    slot = slot.prev_slot
                } else {
                    if (arg2 === 0xFFFF || arg2 === slot.live_pge.init_PGE.object_type) {
                        return slot.live_pge
                    } else {
                        slot = slot.prev_slot
                    }
                }
            }
        }

        return null
    }

    col_findCurrentCollidingObject(pge: LivePGE, n1: number, n2: number, n3: number) {
        const res = {
            obj: 0,
            pge_out: pge
        }
        if (pge.collision_slot !== 0xFF) {
            let cs:CollisionSlot = this._col_slotsTable[pge.collision_slot]
            while (cs) {
                const col_pge:LivePGE = cs.live_pge
                res.pge_out = col_pge

                if (col_pge.init_PGE.object_type === n1 ||
                    col_pge.init_PGE.object_type === n2 ||
                    col_pge.init_PGE.object_type === n3) {
                    res.obj = col_pge.init_PGE.colliding_icon_num
                    return res
                } else {
                    cs = cs.prev_slot
                }
            }
        }
        return res
    }

    printSaveStateCompleted() {
        if (this._saveStateCompleted) {
            const str = this._res.getMenuString(LocaleData.Id.LI_05_COMPLETED)
            this._vid.drawString(str, ((176 - str.length * Video.CHAR_W) / 2) >> 0, 34, 0xE6)
        }
    }

    drawLevelTexts() {
        const pge: LivePGE = this._pgeLive[0]
        let { obj, pge_out } = this.col_findCurrentCollidingObject(pge, 3, 0xFF, 0xFF)
        if (obj === 0) {
            const res = this.col_findCurrentCollidingObject(pge_out, 0xFF, 5, 9)
            obj = res.obj
            pge_out = res.pge_out
        }
        if (obj > 0) {
            this._printLevelCodeCounter = 0
            if (this._textToDisplay === 0xFFFF) {
                const icon_num = obj - 1
                this.drawIcon(icon_num, 80, 8, 0xA)
                const txt_num = pge_out.init_PGE.text_num % 256
                const str = this._res.getTextString(this._currentLevel, txt_num)
                this.drawString(str, 176, 26, 0xE6, true)
                if (icon_num === 2) {
                    this.printSaveStateCompleted()
                    return
                }
            } else {
                this._currentInventoryIconNum = obj - 1
            }
        }
        this._saveStateCompleted = false
    }

    async updateTiming() {
        const frameHz = 30
        const delay = this._stub.getTimeStamp() - this._frameTimestamp
        let pause = (this._stub._pi.dbgMask & DF_FASTMODE) ? 20 : (1000 / frameHz)
        pause -= delay
        if (pause > 0) {
            await this._stub.sleep(pause)
        }
        this._frameTimestamp = this._stub.getTimeStamp()
    }

    saveGameState(slot: number) {
        // TODO
        return
    }

    loadGameState(slot: number) {
        // TODO
        return true
        // if (slot === kAutoSaveSlot) {
        //     return this.loadStateRewind()
        // }
        // let success = false
        // char stateFile[32];
        // makeGameStateName(slot, stateFile);
        // File f;
        // if (!f.open(stateFile, "zrb", _savePath)) {
        //     warning("Unable to open state file '%s'", stateFile);
        // } else {
        //     uint32_t id = f.readUint32BE();
        //     if (id != TAG_FBSV) {
        //         warning("Bad save state format");
        //     } else {
        //         uint16_t ver = f.readUint16BE();
        //         if (ver != 2) {
        //             warning("Invalid save state version");
        //         } else {
        //             // header
        //             char buf[32];
        //             f.read(buf, sizeof(buf));
        //             // contents
        //             loadState(&f);
        //             if (f.ioErr()) {
        //                 warning("I/O error when loading game state");
        //             } else {
        //                 debug(DBG_INFO, "Loaded state from slot %d", slot);
        //                 success = true;
        //             }
        //         }
        //     }
        // }
        // return success;
    }

    async handleContinueAbort() {
        if (this._stub.hasWidescreen()) {
            this._stub.clearWidescreen()
        }
        await this.playCutscene(0x48)
        let timeout = 100
        let current_color = 0
        const colors = [ 0xE4, 0xE5 ]
        let color_inc = 0xFF
        const col: Color = { r: 0, g: 0, b: 0 }
        this._stub.getPaletteEntry(0xE4, col)
        this._vid._tempLayer.set(this._vid._frontLayer.subarray(0, this._vid._layerSize))
        while (timeout >= 0 && !this._stub._pi.quit) {
            let str = this._res.getMenuString(LocaleData.Id.LI_01_CONTINUE_OR_ABORT)
            this._vid.drawString(str, ((Video.GAMESCREEN_W - str.length * Video.CHAR_W) / 2) >> 0, 64, 0xE3)
            str = this._res.getMenuString(LocaleData.Id.LI_02_TIME)
            let buf = str + " : " + ((timeout / 10) >> 0)
            this._vid.drawString(buf, 96, 88, 0xE3)
            str = this._res.getMenuString(LocaleData.Id.LI_03_CONTINUE)
            this._vid.drawString(str, ((Video.GAMESCREEN_W - str.length * Video.CHAR_W) / 2) >> 0, 104, colors[0])
            str = this._res.getMenuString(LocaleData.Id.LI_04_ABORT)
            this._vid.drawString(str, ((Video.GAMESCREEN_W - str.length * Video.CHAR_W) / 2) >> 0, 112, colors[1])
            buf = "SCORE  " + this._score.toString().padStart(8, "0")
            this._vid.drawString(buf, 64, 154, 0xE3)
            if (this._stub._pi.dirMask & DIR_UP) {
                this._stub._pi.dirMask &= ~DIR_UP
                if (current_color > 0) {
                    const color1 = colors[current_color]
                    colors[current_color] = colors[current_color - 1]
                    colors[current_color - 1] = color1
                    --current_color
                }
            }
            if (this._stub._pi.dirMask & DIR_DOWN) {
                this._stub._pi.dirMask &= ~DIR_DOWN
                if (current_color < 1) {
                    const color1 = colors[current_color]                    
                    colors[current_color] = colors[current_color + 1]
                    colors[current_color + 1] = color1                    
                    ++current_color
                }
            }
            if (this._stub._pi.enter) {
                this._stub._pi.enter = false
                return (current_color == 0)
            }
            this._stub.copyRect(0, 0, this._vid._w, this._vid._h, this._vid._frontLayer, this._vid._w)
            await this._stub.updateScreen(0)
            const COLOR_STEP = 8
            const COLOR_MIN = 16
            const COLOR_MAX = 256 - 16
            if (col.b >= COLOR_MAX) {
                color_inc = 0
            } else if (col.b < COLOR_MIN) {
                color_inc = 0xFF
            }
            if (color_inc == 0xFF) {
                col.b += COLOR_STEP
                col.g += COLOR_STEP
            } else {
                col.b -= COLOR_STEP
                col.g -= COLOR_STEP
            }
            this._stub.setPaletteEntry(0xE4, col)
            await this._stub.processEvents()
            await this._stub.sleep(100)
            --timeout
            this._vid._frontLayer.set(this._vid._tempLayer.subarray(0, this._vid._layerSize))
        }
        return false
    }

    printLevelCode() {
        if (this._printLevelCodeCounter !== 0) {
            --this._printLevelCodeCounter
            if (this._printLevelCodeCounter !== 0) {
                const buf = "CODE: " + this._menu.getLevelPassword(this._currentLevel, this._skillLevel)
                this._vid.drawString(buf, ((Video.GAMESCREEN_W - buf.length * Video.CHAR_W) / 2) >> 0, 16, 0xE7)
            }
        }
    }

    static getLineLength(str: Uint8Array) {
        let len = 0
        let index = 0
        while (str[index] && str[index] !== 0xB && str[index] !== 0xA) {
            ++index
            ++len
        }
        return len
    }

    async drawStoryTexts() {
        if (this._textToDisplay !== 0xFFFF) {
            let textColor = 0xE8
            let str = this._res.getGameString(this._textToDisplay)
            let index = 0
            this._vid._tempLayer.set(this._vid._frontLayer.subarray(0, this._vid._layerSize))
            let textSpeechSegment = 0
            let textSegmentsCount = 0
            while (!this._stub._pi.quit) {
                this.drawIcon(this._currentInventoryIconNum, 80, 8, 0xA)
                let yPos = 26
                if (this._res._type == ResourceType.kResourceTypeMac) {
                    // TODO
                    debugger
                    // if (textSegmentsCount === 0) {
                    //     textSegmentsCount = *str++;
                    // }
                    // int len = *str++;
                    // if (*str == '@') {
                    //     switch (str[1]) {
                    //     case '1':
                    //         textColor = 0xE9;
                    //         break;
                    //     case '2':
                    //         textColor = 0xEB;
                    //         break;
                    //     default:
                    //         warning("Unhandled MAC text color code 0x%x", str[1]);
                    //         break;
                    //     }
                    //     str += 2;
                    //     len -= 2;
                    // }
                    // for (; len > 0; yPos += 8) {
                    //     const uint8_t *next = (const uint8_t *)memchr(str, 0x7C, len);
                    //     if (!next) {
                    //         _vid.drawStringLen((const char *)str, len, (176 - len * Video::CHAR_W) / 2, yPos, textColor);
                    //         // point 'str' to beginning of next text segment
                    //         str += len;
                    //         break;
                    //     }
                    //     const int lineLength = next - str;
                    //     _vid.drawStringLen((const char *)str, lineLength, (176 - lineLength * Video::CHAR_W) / 2, yPos, textColor);
                    //     str = next + 1;
                    //     len -= lineLength + 1;
                    // }
                } else {
                    if (str[index] === 0xFF) {
                        if (this._res._lang === Language.LANG_JP) {
                            switch (str[index + 1]) {
                            case 0:
                                textColor = 0xE9
                                break
                            case 1:
                                textColor = 0xEB
                                break
                            default:
                                console.warn(`Unhandled JP text color code 0x${str[index+1]}`)
                                break
                            }
                            index += 2
                        } else {
                            textColor = str[index + 1]
                            index += 3
                        }
                    }
                    while (1) {
                        const len = Game.getLineLength(str)
                        const string = this._vid.drawString(new TextDecoder().decode(str).split('\u0000')[0], ((176 - len * Video.CHAR_W) / 2) >> 0, yPos, textColor)
                        str = new Uint8Array(string.length)
                        for (let idx = 0; idx < string.length; ++idx) {
                            str[idx] = string.charCodeAt(idx)
                        }
                        index = 0
                        if (str[index] === 0 || str[index] === 0xB) {
                            break
                        }
                        index++
                        yPos += 8
                    }
                }
                let voiceSegmentData: Uint8Array = null
                let voiceSegmentLen = 0
                // voiceSegmentData, voiceSegmentLen
                const res = await this._res.load_VCE(this._textToDisplay, textSpeechSegment++)
                voiceSegmentData = res.buf
                voiceSegmentLen = res.bufSize
                if (voiceSegmentData) {
                    this._mix.play(voiceSegmentData, voiceSegmentLen, 32000, MAX_VOLUME)
                }
                await this._vid.updateScreen()
                while (!this._stub._pi.backspace && !this._stub._pi.quit) {
                    if (voiceSegmentData && !this._mix.isPlaying(voiceSegmentData)) {
                        break
                    }
                    await this.inp_update()
                    await this._stub.sleep(80)
                }
                if (voiceSegmentData) {
                    this._mix.stopAll()
                }
                this._stub._pi.backspace = false
                if (this._res._type === ResourceType.kResourceTypeMac) {
                    if (textSpeechSegment === textSegmentsCount) {
                        break
                    }
                } else {
                    if (str[index] === 0) {
                        break
                    }
                    index++
                }
                this._vid._frontLayer.set(this._vid._tempLayer.subarray(0, this._vid._layerSize))
            }
            this._textToDisplay = 0xFFFF
        }
    }

    async mainLoop() {
        await this.playCutscene()
        if (this._cut._id === 0x3D) {
            await this.showFinalScore()
            this._endLoop = true
            return
        }

        if (this._deathCutsceneCounter) {
            --this._deathCutsceneCounter
            if (this._deathCutsceneCounter === 0) {
                await this.playCutscene(this._cut._deathCutsceneId)
                if (!await this.handleContinueAbort()) {
                    await this.playCutscene(0x41)
                    this._endLoop = true
                } else {
                    if (this._autoSave && this._rewindLen !== 0 && this.loadGameState(kAutoSaveSlot)) {
                        // autosave
                    } else if (this._validSaveState && this.loadGameState(kIngameSaveSlot)) {
                        // ingame save
                    } else {
                        this.clearStateRewind()
                        await this.loadLevelData()
                        this.resetGameState()
                    }
                }
                return
            }
        }

        this._vid._frontLayer.set(this._vid._backLayer.subarray(0, this._vid._layerSize))
        await this.pge_getInput()
        this.pge_prepare()
        this.col_prepareRoomState()
        const oldLevel = this._currentLevel
        this.renders > this.debugStartFrame && console.log(`*** processing pge size=${this._res._pgeNum}`)
        for (let i = 0; i < this._res._pgeNum; ++i) {
            const pge: LivePGE = this._pge_liveTable2[i]
            this.renders > this.debugStartFrame && console.log(`>> livePge[${i}]: 0x${pge} anim_seq=${pge ? pge.anim_seq : null} index=${pge ? pge.index : null}`)
            if (pge) {
                this._col_currentPiegeGridPosY = ((pge.pos_y / 36) >> 0) & ~1
                this._col_currentPiegeGridPosX = (pge.pos_x + 8) >> 4
                this.pge_process(pge)
            }
            this.renders > this.debugStartFrame && console.log('<< livePge END')
        }
        this.renders > this.debugStartFrame && console.log(`*** end pge size=${this._res._pgeNum}`)
        if (oldLevel != this._currentLevel) {
            if (this._res._isDemo) {
                this._currentLevel = oldLevel
            }
            await this.changeLevel()
            this._pge_opTempVar1 = 0
            return
        }

        if (this._loadMap) {
            if (this._currentRoom === 0xFF || !this.hasLevelMap(this._currentLevel, this._pgeLive[0].room_location)) {
                this._cut._id = 6
                this._deathCutsceneCounter = 1
            } else {
                this._currentRoom = this._pgeLive[0].room_location
                await this.loadLevelMap()
                this._loadMap = false
                this._vid.fullRefresh()
            }
        }
        await this.prepareAnims()
        await this.drawAnims()
        this.renders++
        this.drawCurrentInventoryItem()
        this.drawLevelTexts()
        if (g_options.enable_password_menu) {
            // TODO
            debugger
            this.printLevelCode()
        }
        if (this._blinkingConradCounter !== 0) {
            --this._blinkingConradCounter
        }

        await this._vid.updateScreen()
        await this.updateTiming()
        await this.drawStoryTexts()
        if (this._stub._pi.backspace) {
            this._stub._pi.backspace = false
            await this.handleInventory()
        }
        if (this._stub._pi.escape) {
            this._stub._pi.escape = false
            if (this._demoBin !== -1 || await this.handleConfigPanel()) {
                this._endLoop = true
                return
            }
        }
        this.inp_handleSpecialKeys()
        if (this._autoSave && this._stub.getTimeStamp() - this._saveTimestamp >= kAutoSaveIntervalMs) {
            // do not save if we died or about to
            if (this._pgeLive[0].life > 0 && this._deathCutsceneCounter === 0) {
                this.saveGameState(kAutoSaveSlot)
                this._saveTimestamp = this._stub.getTimeStamp()
            }
        }
    }

    async playCutsceneSeq(name: string): Promise<boolean> {
        const f = new File()
        if (await f.open(name, "rb", this._fs)) {
            this._seq.setBackBuffer(this._res._scratchBuffer)
            this._seq.play(f)
            this._vid.fullRefresh()
            return true
        }
        return false
    }

    inp_handleSpecialKeys() {
        if (this._stub._pi.dbgMask & DF_SETLIFE) {
            this._pgeLive[0].life = 0x7FFF
        }
        if (this._stub._pi.load) {
            this.loadGameState(this._stateSlot)
            this._stub._pi.load = false
        }
        if (this._stub._pi.save) {
            this.saveGameState(this._stateSlot)
            this._stub._pi.save = false
        }
        if (this._stub._pi.stateSlot !== 0) {
            let slot = this._stateSlot + this._stub._pi.stateSlot
            if (slot >= 1 && slot < 100) {
                this._stateSlot = slot
                console.log(`Current game state slot is ${this._stateSlot}`)
            }
            this._stub._pi.stateSlot = 0
        }
        if (this._stub._pi.rewind) {
            if (this._rewindLen !== 0) {
                this.loadStateRewind()
            } else {
                console.log("Rewind buffer is empty")
            }
            this._stub._pi.rewind = false
        }
    }

    loadStateRewind() {
        const ptr = this._rewindPtr
        if (this._rewindPtr === 0) {
            this._rewindPtr = kRewindSize - 1
        } else {
            --this._rewindPtr
        }
        const f:File = this._rewindBuffer[ptr]
        f.seek(0)
        this.loadState(f)
        if (this._rewindLen > 0) {
            --this._rewindLen
        }
        return !f.ioErr()
    }

    loadState(f: File) {
        // TODO
        debugger
    }

    async handleConfigPanel() {
        const x = 7
        const y = 10
        const w = 17
        const h = 12
    
        this._vid._charShadowColor = 0xE2
        this._vid._charFrontColor = 0xEE
        this._vid._charTransparentColor = 0xFF
    
        // the panel background is drawn using special characters from FB_TXT.FNT
        const kUseDefaultFont = true
    
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            for (let i = 0; i < h; ++i) {
                for (let j = 0; j < w; ++j) {
                    this._vid.fillRect(Video.CHAR_W * (x + j), Video.CHAR_H * (y + i), Video.CHAR_W, Video.CHAR_H, 0xE2)
                }
            }
            break
        case ResourceType.kResourceTypeDOS:
            // top-left rounded corner
            this._vid.PC_drawChar(0x81, y, x, kUseDefaultFont)
            // top-right rounded corner
            this._vid.PC_drawChar(0x82, y, x + w, kUseDefaultFont)
            // bottom-left rounded corner
            this._vid.PC_drawChar(0x83, y + h, x, kUseDefaultFont)
            // bottom-right rounded corner
            this._vid.PC_drawChar(0x84, y + h, x + w, kUseDefaultFont)
            // horizontal lines
            for (let i = 1; i < w; ++i) {
                this._vid.PC_drawChar(0x85, y, x + i, kUseDefaultFont)
                this._vid.PC_drawChar(0x88, y + h, x + i, kUseDefaultFont)
            }
            for (let j = 1; j < h; ++j) {
                this._vid._charTransparentColor = 0xFF
                // left vertical line
                this._vid.PC_drawChar(0x86, y + j, x, kUseDefaultFont)
                // right vertical line
                this._vid.PC_drawChar(0x87, y + j, x + w, kUseDefaultFont)
                this._vid._charTransparentColor = 0xE2
                for (let i = 1; i < w; ++i) {
                    this._vid.PC_drawChar(0x20, y + j, x + i, kUseDefaultFont)
                }
            }
            break
        case ResourceType.kResourceTypeMac:
            // top-left rounded corner
            this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * x, Video.CHAR_H * y, this._res._fnt, this._vid._charFrontColor, 0x81)
            // top-right rounded corner
            this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + w), Video.CHAR_H * y, this._res._fnt, this._vid._charFrontColor, 0x82)
            // bottom-left rounded corner
            this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * x, Video.CHAR_H * (y + h), this._res._fnt, this._vid._charFrontColor, 0x83)
            // bottom-right rounded corner
            this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + w), Video.CHAR_H * (y + h), this._res._fnt, this._vid._charFrontColor, 0x84)
            // horizontal lines
            for (let i = 1; i < w; ++i) {
                this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + i), Video.CHAR_H * y, this._res._fnt, this._vid._charFrontColor, 0x85)
                this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + i), Video.CHAR_H * (y + h), this._res._fnt, this._vid._charFrontColor, 0x88)
            }
            // vertical lines
            for (let i = 1; i < h; ++i) {
                this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * x, Video.CHAR_H * (y + i), this._res._fnt, this._vid._charFrontColor, 0x86)
                this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + w), Video.CHAR_H * (y + i), this._res._fnt, this._vid._charFrontColor, 0x87)
                for (let j = 1; j < w; ++j) {
                    this._vid.fillRect(Video.CHAR_W * (x + j), Video.CHAR_H * (y + i), Video.CHAR_W, Video.CHAR_H, 0xE2)
                }
            }
            break
        }
    
        this._menu._charVar3 = 0xE4
        this._menu._charVar4 = 0xE5
        this._menu._charVar1 = 0xE2
        this._menu._charVar2 = 0xEE
    
        this._vid.fullRefresh()
        const MENU_ITEM_ABORT = 1
        const MENU_ITEM_LOAD = 2
        const MENU_ITEM_SAVE = 3
        const colors = [ 2, 3, 3, 3 ]
        let current = 0
        while (!this._stub._pi.quit) {
            this._menu.drawString(this._res.getMenuString(LocaleData.Id.LI_18_RESUME_GAME), y + 2, 9, colors[0])
            this._menu.drawString(this._res.getMenuString(LocaleData.Id.LI_19_ABORT_GAME), y + 4, 9, colors[1])
            this._menu.drawString(this._res.getMenuString(LocaleData.Id.LI_20_LOAD_GAME), y + 6, 9, colors[2])
            this._menu.drawString(this._res.getMenuString(LocaleData.Id.LI_21_SAVE_GAME), y + 8, 9, colors[3])
            this._vid.fillRect(Video.CHAR_W * (x + 1), Video.CHAR_H * (y + 10), Video.CHAR_W * (w - 2), Video.CHAR_H, 0xE2)
            const buf = this._res.getMenuString(LocaleData.Id.LI_22_SAVE_SLOT) + " < " + this._stateSlot.toString().padStart(2, "0") + " >"
            this._menu.drawString(buf, y + 10, 9, 1)
    
            this._vid.updateScreen()
            await this._stub.sleep(80)
            await this.inp_update()
    
            let prev = current
            if (this._stub._pi.dirMask & DIR_UP) {
                this._stub._pi.dirMask &= ~DIR_UP
                current = (current + 3) % 4
            }
            if (this._stub._pi.dirMask & DIR_DOWN) {
                this._stub._pi.dirMask &= ~DIR_DOWN
                current = (current + 1) % 4
            }
            if (this._stub._pi.dirMask & DIR_LEFT) {
                this._stub._pi.dirMask &= ~DIR_LEFT
                --this._stateSlot
                if (this._stateSlot < 1) {
                    this._stateSlot = 1
                }
            }
            if (this._stub._pi.dirMask & DIR_RIGHT) {
                this._stub._pi.dirMask &= ~DIR_RIGHT
                ++this._stateSlot
                if (this._stateSlot > 99) {
                    this._stateSlot = 99
                }
            }
            if (prev !== current) {
                const tmp = colors[prev]
                colors[prev] = colors[current]
                colors[current] = tmp
            }
            if (this._stub._pi.enter) {
                this._stub._pi.enter = false
                switch (current) {
                case MENU_ITEM_LOAD:
                    this._stub._pi.load = true
                    break
                case MENU_ITEM_SAVE:
                    this._stub._pi.save = true
                    break
                }
                break
            }
            if (this._stub._pi.escape) {
                this._stub._pi.escape = false
                break
            }
        }
        this._vid.fullRefresh()
        return (current === MENU_ITEM_ABORT)
    }

    drawString(p: Uint8Array, x: number, y: number, color: number, hcenter: boolean) {
        let str = new TextDecoder().decode(p).split('\u0000')[0]
        let len = 0
        if (this._res._type === ResourceType.kResourceTypeMac) {
            // TODO
            debugger
            len = p[0]
            str = str.substr(1)
        } else {
            len = str.length
        }
        if (hcenter) {
            x = ((x - len * Video.CHAR_W) / 2) >> 0
        }

        this._vid.drawStringLen(str, len, x, y, color)
    }

    async prepareAnims() {
        if (!(this._currentRoom & 0x80) && this._currentRoom < 0x40) {
            let pge_room: number
            let pge: LivePGE = this._pge_liveTable1[this._currentRoom]
            while (pge) {
                await this.prepareAnimsHelper(pge, 0, 0)
                pge = pge.next_PGE_in_room
            }
            pge_room = this._res._ctData[CT_UP_ROOM + this._currentRoom]
            if (pge_room >= 0 && pge_room < 0x40) {
                pge = this._pge_liveTable1[pge_room]
                while (pge) {
                    if ((pge.init_PGE.object_type !== 10 && pge.pos_y > 176) || (pge.init_PGE.object_type === 10 && pge.pos_y > 216)) {
                        await this.prepareAnimsHelper(pge, 0, -216)
                    }
                    pge = pge.next_PGE_in_room
                }
            }
            pge_room = this._res._ctData[CT_DOWN_ROOM + this._currentRoom]
            if (pge_room >= 0 && pge_room < 0x40) {
                pge = this._pge_liveTable1[pge_room]
                while (pge) {
                    if (pge.pos_y < 48) {
                        await this.prepareAnimsHelper(pge, 0, 216)
                    }
                    pge = pge.next_PGE_in_room
                }
            }
            pge_room = this._res._ctData[CT_LEFT_ROOM + this._currentRoom]
            if (pge_room >= 0 && pge_room < 0x40) {
                pge = this._pge_liveTable1[pge_room]
                while (pge) {
                    if (pge.pos_x > 224) {
                        await this.prepareAnimsHelper(pge, -256, 0)
                    }
                    pge = pge.next_PGE_in_room
                }
            }
            pge_room = this._res._ctData[CT_RIGHT_ROOM + this._currentRoom]
            if (pge_room >= 0 && pge_room < 0x40) {
                pge = this._pge_liveTable1[pge_room]
                while (pge) {
                    if (pge.pos_x <= 32) {
                        await this.prepareAnimsHelper(pge, 256, 0)
                    }
                    pge = pge.next_PGE_in_room
                }
            }
        }
    }
    
    async prepareAnimsHelper(pge: LivePGE, dx: number, dy: number) {
        if (!(pge.flags & 8)) {
            if (pge.index !== 0 && await this.loadMonsterSprites(pge) === 0) {
                return
            }
            let dataPtr = null
            let dw = 0
            let dh = 0
            switch (this._res._type) {
            case ResourceType.kResourceTypeAmiga:
            case ResourceType.kResourceTypeDOS:
                if (pge.anim_number >= 1287) {
                    throw(`Assertion failed: ${pge.anim_number} < 1287`)
                }
                dataPtr = this._res._sprData[pge.anim_number]
                if (dataPtr === null) {
                    return
                }
                dw = dataPtr[0] << 24 >> 24
                dh = dataPtr[1] << 24 >> 24
                break
            case ResourceType.kResourceTypeMac:
                break
            }
            let w = 0
            let h = 0
            switch (this._res._type) {
            case ResourceType.kResourceTypeAmiga:
                w = ((dataPtr[2] >> 7) + 1) * 16
                h = dataPtr[2] & 0x7F
                break
            case ResourceType.kResourceTypeDOS:
                w = dataPtr[2]
                h = dataPtr[3]
                dataPtr = dataPtr.subarray(4)
                break
            case ResourceType.kResourceTypeMac:
                break
            }
            let ypos = dy + pge.pos_y - dh + 2
            let xpos = dx + pge.pos_x - dw
            if (pge.flags & 2) {
                xpos = dw + dx + pge.pos_x
                let _cl = w
                if (_cl & 0x40) {
                    _cl = h
                } else {
                    _cl &= 0x3F
                }
                xpos -= _cl
            }
            if (xpos <= -32 || xpos >= 256 || ypos < -48 || ypos >= 224) {
                return
            }
            xpos += 8
            if (pge === this._pgeLive[0]) {
                this._animBuffers.addState(1, xpos, ypos, dataPtr, pge, w, h)
            } else if (pge.flags & 0x10) {
                this._animBuffers.addState(2, xpos, ypos, dataPtr, pge, w, h)
            } else {
                this._animBuffers.addState(0, xpos, ypos, dataPtr, pge, w, h)
            }
        } else {
            let dataPtr = null
            switch (this._res._type) {
            case ResourceType.kResourceTypeAmiga:
            case ResourceType.kResourceTypeDOS:
                if (pge.anim_number >= this._res._numSpc) {
                    throw(`Assertion failed: ${pge.anim_number} < ${this._res._numSpc}`)
                }
                dataPtr = this._res._spc.subarray(READ_BE_UINT16(this._res._spc, pge.anim_number * 2))
                break
            case ResourceType.kResourceTypeMac:
                break
            }
            const xpos = dx + pge.pos_x + 8
            const ypos = dy + pge.pos_y + 2
            if (pge.init_PGE.object_type === 11) {
                this._animBuffers.addState(3, xpos, ypos, dataPtr, pge)
            } else if (pge.flags & 0x10) {
                this._animBuffers.addState(2, xpos, ypos, dataPtr, pge)
            } else {
                this._animBuffers.addState(0, xpos, ypos, dataPtr, pge)
            }
        }
    }
    
    async drawAnims() {
        this._eraseBackground = false
        await this.drawAnimBuffer(2, this._animBuffer2State)
        await this.drawAnimBuffer(1, this._animBuffer1State)
        await this.drawAnimBuffer(0, this._animBuffer0State)
        this._eraseBackground = true
        await this.drawAnimBuffer(3, this._animBuffer3State)
    }
    
    async drawAnimBuffer(stateNum: number, state: AnimBufferState[]) {
        if (stateNum >= 4) {
            throw(`Assertion failed: ${stateNum} < 4`)
        }
        this._animBuffers._states[stateNum] = state
        const lastPos = this._animBuffers._curPos[stateNum]

        if (lastPos !== 0xFF) {
            let index = lastPos
            let numAnims = lastPos + 1
            this._animBuffers._curPos[stateNum] = 0xFF
            let i = 0;
            do {
        
                const pge: LivePGE = state[index].pge
                if (!(pge.flags & 8)) {
                    if (stateNum === 1 && (this._blinkingConradCounter & 1)) {
                        break
                    }
                    switch (this._res._type) {
                    case ResourceType.kResourceTypeAmiga:
                        this._vid.AMIGA_decodeSpm(state[index].dataPtr, this._res._scratchBuffer)
                        this.drawCharacter(this._res._scratchBuffer, state[index].x, state[index].y, state[index].h, state[index].w, pge.flags)
                        break
                    case ResourceType.kResourceTypeDOS:
                        const ptr = state[index].dataPtr
                        const val = new DataView(ptr.buffer, ptr.byteOffset - 2).getUint8(0)
                        if (!(val & 0x80)) {
                            this._vid.PC_decodeSpm(state[index].dataPtr, this._res._scratchBuffer)
                            this.drawCharacter(this._res._scratchBuffer, state[index].x, state[index].y, state[index].h, state[index].w, pge.flags)
                        } else {
                            this.drawCharacter(state[index].dataPtr, state[index].x, state[index].y, state[index].h, state[index].w, pge.flags)
                        }
                        break
                    case ResourceType.kResourceTypeMac:
                        this.drawPiege(state[index])
                        break
                    }
                } else {
                    this.drawPiege(state[index])
                }
                index--
            } while (--numAnims !== 0)
        }
    }


    drawPiege(state: AnimBufferState) {
        const pge: LivePGE = state.pge
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
        case ResourceType.kResourceTypeDOS:
            this.drawObject(state.dataPtr, state.x, state.y, pge.flags)
            break
        case ResourceType.kResourceTypeMac:
            if (pge.flags & 8) {
                this._vid.MAC_drawSprite(state.x, state.y, this._res._spc, pge.anim_number, (pge.flags & 2) !== 0, this._eraseBackground)
            } else if (pge.index === 0) {
                if (pge.anim_number === 0x386) {
                    break
                }
                const frame = this._res.MAC_getPersoFrame(pge.anim_number)
                this._vid.MAC_drawSprite(state.x, state.y, this._res._perso, frame, (pge.flags & 2) !==0, this._eraseBackground)
            } else {
                const frame = this._res.MAC_getMonsterFrame(pge.anim_number)
                this._vid.MAC_drawSprite(state.x, state.y, this._res._monster, frame, (pge.flags & 2) !== 0, this._eraseBackground)
            }
            break
        }
    }
    
    drawObject(dataPtr: Uint8Array, x: number, y: number, flags: number) {
        if (dataPtr[0] >= 0x4A) {
            throw(`Assertion failed: ${dataPtr[0]} < 0x4A`)
        } 
        const slot = this._res._rp[dataPtr[0]]
        let data = this._res.findBankData(slot)
        if (data === null) {
            data = this._res.loadBankData(slot)
        }
        let posy = y - (dataPtr[2] << 24 >>24)
        let posx = x
        if (flags & 2) {
            posx = posx + (dataPtr[1] << 24 >>24)
        } else {
            posx = posx - (dataPtr[1] << 24 >>24)
        }
        let count = 0;
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            count = dataPtr[8]
            dataPtr = dataPtr.subarray(9)
            break
        case ResourceType.kResourceTypeDOS:
            count = dataPtr[5]
            dataPtr = dataPtr.subarray(6)
            break
        case ResourceType.kResourceTypeMac:
            // assert(0); // different graphics format
            break
        }
        for (let i = 0; i < count; ++i) {
            this.drawObjectFrame(data, dataPtr, posx, posy, flags)
            dataPtr = dataPtr.subarray(4)
        }
    }
    
    drawObjectFrame(bankDataPtr: Uint8Array, dataPtr: Uint8Array, x: number, y: number, flags: number) {
        let src = bankDataPtr.byteOffset + dataPtr[0] * 32
    
        let sprite_y = y + dataPtr[2]
        let sprite_x
        if (flags & 2) {
            sprite_x = x - dataPtr[1] - (((dataPtr[3] & 0xC) + 4) * 2)
        } else {
            sprite_x = x + dataPtr[1]
        }
    
        let sprite_flags = dataPtr[3]
        if (flags & 2) {
            sprite_flags ^= 0x10
        }
    
        const sprite_h = (((sprite_flags >> 0) & 3) + 1) * 8
        let sprite_w = (((sprite_flags >> 2) & 3) + 1) * 8
    
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            this._vid.AMIGA_decodeSpc(new Uint8Array(bankDataPtr.buffer, src), sprite_w, sprite_h, this._res._scratchBuffer)
            break
        case ResourceType.kResourceTypeDOS:
            this._vid.PC_decodeSpc(new Uint8Array(bankDataPtr.buffer, src), sprite_w, sprite_h, this._res._scratchBuffer)
            break
        case ResourceType.kResourceTypeMac:
            // assert(0); // different graphics format
            break
        }
    
        src = this._res._scratchBuffer.byteOffset
        let sprite_mirror_x = false
        let sprite_clipped_w
        if (sprite_x >= 0) {
            sprite_clipped_w = sprite_x + sprite_w
            if (sprite_clipped_w < 256) {
                sprite_clipped_w = sprite_w
            } else {
                sprite_clipped_w = 256 - sprite_x
                if (sprite_flags & 0x10) {
                    sprite_mirror_x = true
                    src += sprite_w - 1
                }
            }
        } else {
            sprite_clipped_w = sprite_x + sprite_w
            if (!(sprite_flags & 0x10)) {
                src -= sprite_x
                sprite_x = 0
            } else {
                sprite_mirror_x = true
                src += sprite_x + sprite_w - 1
                sprite_x = 0
            }
        }
        if (sprite_clipped_w <= 0) {
            return
        }
    
        let sprite_clipped_h
        if (sprite_y >= 0) {
            sprite_clipped_h = 224 - sprite_h
            if (sprite_y < sprite_clipped_h) {
                sprite_clipped_h = sprite_h
            } else {
                sprite_clipped_h = 224 - sprite_y
            }
        } else {
            sprite_clipped_h = sprite_h + sprite_y
            src -= sprite_w * sprite_y
            sprite_y = 0
        }
        if (sprite_clipped_h <= 0) {
            return
        }
    
        if (!sprite_mirror_x && (sprite_flags & 0x10)) {
            src += sprite_w - 1
        }
    
        let dst_offset = 256 * sprite_y + sprite_x
        let sprite_col_mask = (flags & 0x60) >> 1
    
        if (this._eraseBackground) {
            if (!(sprite_flags & 0x10)) {
                this._vid.drawSpriteSub1(new Uint8Array(this._res._scratchBuffer.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_w, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            } else {
                this._vid.drawSpriteSub2(new Uint8Array(this._res._scratchBuffer.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_w, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            }
        } else {
            if (!(sprite_flags & 0x10)) {
                this._vid.drawSpriteSub3(new Uint8Array(this._res._scratchBuffer.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_w, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            } else {
                this._vid.drawSpriteSub4(new Uint8Array(this._res._scratchBuffer.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_w, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            }
        }
        this._vid.markBlockAsDirty(sprite_x, sprite_y, sprite_clipped_w, sprite_clipped_h, this._vid._layerScale)
    }
    
    drawCharacter(dataPtr: Uint8Array, pos_x: number, pos_y: number, a: number, b: number, flags: number) {
        let var16 = false // sprite_mirror_y
        if (b & 0x40) {
            b &= 0xBF
            const temp = a
            a = b
            b = temp
            var16 = true
        }
        let sprite_h = a
        let sprite_w = b
    
        let src = dataPtr.byteOffset
        let var14 = false
    
        let sprite_clipped_w
        if (pos_x >= 0) {
            if (pos_x + sprite_w < 256) {
                sprite_clipped_w = sprite_w
            } else {
                sprite_clipped_w = 256 - pos_x
                if (flags & 2) {
                    var14 = true
                    if (var16) {
                        src += (sprite_w - 1) * sprite_h
                    } else {
                        src += sprite_w - 1
                    }
                }
            }
        } else {
            sprite_clipped_w = pos_x + sprite_w
            if (!(flags & 2)) {
                if (var16) {
                    src -= sprite_h * pos_x
                    pos_x = 0
                } else {
                    src -= pos_x
                    pos_x = 0
                }
            } else {
                var14 = true
                if (var16) {
                    src += sprite_h * (pos_x + sprite_w - 1)
                    pos_x = 0
                } else {
                    src += pos_x + sprite_w - 1
                    var14 = true
                    pos_x = 0
                }
            }
        }
        if (sprite_clipped_w <= 0) {
            return
        }
    
        let sprite_clipped_h
        if (pos_y >= 0) {
            if (pos_y < 224 - sprite_h) {
                sprite_clipped_h = sprite_h
            } else {
                sprite_clipped_h = 224 - pos_y
            }
        } else {
            sprite_clipped_h = sprite_h + pos_y
            if (var16) {
                src -= pos_y
            } else {
                src -= sprite_w * pos_y
            }
            pos_y = 0
        }
        if (sprite_clipped_h <= 0) {
            return
        }
    
        if (!var14 && (flags & 2)) {
            if (var16) {
                src += sprite_h * (sprite_w - 1)
            } else {
                src += sprite_w - 1
            }
        }
    
        let dst_offset = 256 * pos_y + pos_x
        const sprite_col_mask = ((flags & 0x60) === 0x60) ? 0x50 : 0x40
    
        if (!(flags & 2)) {
            if (var16) {
                this._vid.drawSpriteSub5(new Uint8Array(dataPtr.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_h, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            } else {
                this._vid.drawSpriteSub3(new Uint8Array(dataPtr.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_w, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            }
        } else {
            if (var16) {
                this._vid.drawSpriteSub6(new Uint8Array(dataPtr.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_h, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            } else {
                this._vid.drawSpriteSub4(new Uint8Array(dataPtr.buffer, src), this._vid._frontLayer.subarray(dst_offset), sprite_w, sprite_clipped_h, sprite_clipped_w, sprite_col_mask)
            }
        }
        this._vid.markBlockAsDirty(pos_x, pos_y, sprite_clipped_w, sprite_clipped_h, this._vid._layerScale)
    }

    async handleInventory() {
        let selected_pge: LivePGE = null
        const pge: LivePGE = this._pgeLive[0]
        if (pge.life > 0 && pge.current_inventory_PGE !== 0xFF) {
            this.playSound(66, 0)
            const items:InventoryItem[] = new Array(24).fill(null).map(() => ({
                icon_num: 0,
                live_pge: null,
                init_pge: null,
            }))
            let num_items = 0
            let inv_pge = pge.current_inventory_PGE
            while (inv_pge !== 0xFF) {
                items[num_items] = {
                    icon_num: this._res._pgeInit[inv_pge].icon_num,
                    init_pge: this._res._pgeInit[inv_pge],
                    live_pge: this._pgeLive[inv_pge]
                }
                
                inv_pge = this._pgeLive[inv_pge].next_inventory_PGE
                ++num_items
            }
            items[num_items].icon_num = 0xFF
            let current_item = 0
            let num_lines = (((num_items - 1) / 4) >> 0) + 1
            let current_line = 0
            let display_score = false
            while (!this._stub._pi.backspace && !this._stub._pi.quit) {
                const icon_spr_w = 16
                const icon_spr_h = 16
                switch (this._res._type) {
                case ResourceType.kResourceTypeAmiga:
                case ResourceType.kResourceTypeDOS: {
                        // draw inventory background
                        let icon_num = 31
                        for (let y = 140; y < 140 + 5 * icon_spr_h; y += icon_spr_h) {
                            for (let x = 56; x < 56 + 9 * icon_spr_w; x += icon_spr_w) {
                                this.drawIcon(icon_num, x, y, 0xF)
                                ++icon_num
                            }
                        }
                    }
                    if (this._res._type == ResourceType.kResourceTypeAmiga) {
                        // draw outline rectangle
                        const outline_color = 0xE7
                        let p = this._vid._frontLayer.subarray(140 * Video.GAMESCREEN_W + 56)
                        p.fill(outline_color, 1, 9 * icon_spr_w - 2 + 1)
                        p = p.subarray(Video.GAMESCREEN_W)
                        for (let y = 1; y < 5 * icon_spr_h - 1; ++y) {
                            p[0] = p[9 * icon_spr_w - 1] = outline_color
                            p = p.subarray(Video.GAMESCREEN_W)
                        }
                        p.fill(outline_color, 1, 9 * icon_spr_w - 2 + 1)
                    }
                    break
                case ResourceType.kResourceTypeMac:
                    this.drawIcon(31, 56, 140, 0xF)
                    break
                }
                if (!display_score) {
                    let icon_x_pos = 72
                    for (let i = 0; i < 4; ++i) {
                        let item_it = current_line * 4 + i
                        if (items[item_it].icon_num === 0xFF) {
                            break
                        }
                        this.drawIcon(items[item_it].icon_num, icon_x_pos, 157, 0xA)
                        if (current_item === item_it) {
                            this.drawIcon(76, icon_x_pos, 157, 0xA)
                            selected_pge = items[item_it].live_pge
                            const txt_num = items[item_it].init_pge.text_num
                            const str = this._res.getTextString(this._currentLevel, txt_num)
                            this.drawString(str, Video.GAMESCREEN_W, 189, 0xED, true)
                            if (items[item_it].init_pge.init_flags & 4) {
                                const buf = selected_pge.life.toString()
                                this._vid.drawString(buf, ((Video.GAMESCREEN_W - buf.length * Video.CHAR_W) / 2) >> 0, 197, 0xED)
                            }
                        }
                        icon_x_pos += 32
                    }
                    if (current_line != 0) {
                        this.drawIcon(78, 120, 176, 0xA) // down arrow
                    }
                    if (current_line !== num_lines - 1) {
                        this.drawIcon(77, 120, 143, 0xA) // up arrow
                    }
                } else {
                    let buf = "SCORE " + this._score.toString().padStart(8, "0")
                    this._vid.drawString(buf, (((114 - buf.length * Video.CHAR_W) / 2) >> 0) + 72, 158, 0xE5)
                    buf = this._res.getMenuString(LocaleData.Id.LI_06_LEVEL) + ":" + this._res.getMenuString(LocaleData.Id.LI_13_EASY + this._skillLevel)
                    this._vid.drawString(buf, (((114 - buf.length * Video.CHAR_W) / 2) >> 0) + 72, 166, 0xE5)
                }
    
                await this._vid.updateScreen()
                await this._stub.sleep(80)
                await this.inp_update()
    
                if (this._stub._pi.dirMask & DIR_UP) {
                    this._stub._pi.dirMask &= ~DIR_UP
                    if (current_line < num_lines - 1) {
                        ++current_line
                        current_item = current_line * 4
                    }
                }
                if (this._stub._pi.dirMask & DIR_DOWN) {
                    this._stub._pi.dirMask &= ~DIR_DOWN
                    if (current_line > 0) {
                        --current_line
                        current_item = current_line * 4
                    }
                }
                if (this._stub._pi.dirMask & DIR_LEFT) {
                    this._stub._pi.dirMask &= ~DIR_LEFT
                    if (current_item > 0) {
                        let item_num = current_item % 4
                        if (item_num > 0) {
                            --current_item
                        }
                    }
                }
                if (this._stub._pi.dirMask & DIR_RIGHT) {
                    this._stub._pi.dirMask &= ~DIR_RIGHT
                    if (current_item < num_items - 1) {
                        let item_num = current_item % 4
                        if (item_num < 3) {
                            ++current_item
                        }
                    }
                }
                if (this._stub._pi.enter) {
                    this._stub._pi.enter = false
                    display_score = !display_score
                }
            }
            this._vid.fullRefresh()
            this._stub._pi.backspace = false
            if (selected_pge) {
                this.pge_setCurrentInventoryObject(selected_pge)
            }
            this.playSound(66, 0)
        }
    }

    pge_getInventoryItemBefore(pge: LivePGE, last_pge: LivePGE) {
        let _di: LivePGE = pge
        let n = _di.current_inventory_PGE

        while (n !== 0xFF) {
            const _si: LivePGE = this._pgeLive[n]
            if (_si === last_pge) {
                break
            } else {
                _di = _si
                n = _di.next_inventory_PGE
            }
        }
        return _di
    }
    
    pge_removeFromInventory(pge1: LivePGE, pge2: LivePGE, pge3: LivePGE) {
        pge2.unkF = 0xFF
        if (pge3 === pge1) {
            pge3.current_inventory_PGE = pge2.next_inventory_PGE
            pge2.next_inventory_PGE = 0xFF
        } else {
            pge1.next_inventory_PGE = pge2.next_inventory_PGE
            pge2.next_inventory_PGE = 0xFF
        }
    }

    pge_addToInventory(pge1: LivePGE, pge2: LivePGE, pge3: LivePGE) {
        pge2.unkF = pge3.index

        if (pge1 === pge3) {
            pge2.next_inventory_PGE = pge1.current_inventory_PGE
            pge1.current_inventory_PGE = pge2.index
        } else {
            pge2.next_inventory_PGE = pge1.next_inventory_PGE
            pge1.next_inventory_PGE = pge2.index
        }
    }

    pge_setCurrentInventoryObject(pge: LivePGE) {
        const _bx:LivePGE = this.pge_getInventoryItemBefore(this._pgeLive[0], pge)
        if (_bx === this._pgeLive[0]) {
            if (_bx.current_inventory_PGE !== pge.index) {
                return 0
            }
        } else {
            if (_bx.next_inventory_PGE !== pge.index) {
                return 0
            }
        }
        this.pge_removeFromInventory(_bx, pge, this._pgeLive[0])
        this.pge_addToInventory(this._pgeLive[0], pge, this._pgeLive[0])
        return 0xFFFF
    }

    getRandomNumber() {
        let n = this._randSeed * 2
        if ((this._randSeed << 32 >> 32) >= 0) {
            n ^= 0x1D872B41
        }
        this._randSeed = n
        return n & 0xFFFF
    }

    async changeLevel() {
        await this._vid.fadeOut()
        this.clearStateRewind()
        await this.loadLevelData()
        await this.loadLevelMap()
        this._vid.setPalette0xF()
        this._vid.setTextPalette()
        this._vid.fullRefresh()
    }

    async inp_update() {
        await this._stub.processEvents()
        if (this._demoBin !== -1 && this._inp_demPos < this._res._demLen) {
            const keymask = this._res._dem[this._inp_demPos++]
            this._stub._pi.dirMask = keymask & 0xF
            this._stub._pi.enter = (keymask & 0x10) !== 0
            this._stub._pi.space = (keymask & 0x20) !== 0
            this._stub._pi.shift = (keymask & 0x40) !== 0
            this._stub._pi.backspace = (keymask & 0x80) !== 0
        }
    }

    col_prepareRoomState() {
        this._col_activeCollisionSlots.fill(0xFF)
        this._col_currentLeftRoom = this._res._ctData[CT_LEFT_ROOM + this._currentRoom]
        this._col_currentRightRoom = this._res._ctData[CT_RIGHT_ROOM + this._currentRoom]

        for (let i = 0; i != this._col_curPos; ++i) {
            const _di: CollisionSlot = this._col_slotsTable[i]
            const room = (_di.ct_pos / 64) >> 0

            if (room === this._currentRoom) {
                this._col_activeCollisionSlots[0x30 + (_di.ct_pos & 0x3F)] = i
            } else if (room === this._col_currentLeftRoom) {
                this._col_activeCollisionSlots[0x00 + (_di.ct_pos & 0x3F)] = i
            } else if (room === this._col_currentRightRoom) {
                this._col_activeCollisionSlots[0x60 + (_di.ct_pos & 0x3F)] = i
            } 
        }

    // #ifdef DEBUG_COLLISION
    //     printf("---\n");
    //     for (int y = 0; y < 7; ++y) {
    //         for (int x = 0; x < 16; ++x) {
    //             printf("%d", _res._ctData[0x100 + _currentRoom * 0x70 + y * 16 + x]);
    //         }
    //         printf("\n");
    //     }
    // #endif
    }

    col_clearState() {
        this._col_curPos = 0
        this._col_curSlot = this._col_slots[0]
    }

    col_findSlot(pos: number) {
        for (let i = 0; i < this._col_curPos; ++i) {
            if (this._col_slotsTable[i].ct_pos === pos)
                return i
        }
        return -1
    }

    col_getGridData(pge: LivePGE, dy: number, dx: number) {
        if (this._pge_currentPiegeFacingDir) {
            dx = -dx
        }
        const pge_grid_y = this._col_currentPiegeGridPosY + dy
        const pge_grid_x = this._col_currentPiegeGridPosX + dx
        let room_ct_data:Int8Array
        let next_room = 0
        if (pge_grid_x < 0) {
            room_ct_data = this._res._ctData.subarray(CT_LEFT_ROOM)
            next_room = room_ct_data[pge.room_location]
            if (next_room < 0) {
                return 1
            }

            room_ct_data = room_ct_data.subarray(pge_grid_x + 16 + pge_grid_y * 16 + next_room * 0x70)
            return room_ct_data[0x40]
        } else if (pge_grid_x >= 16) {
            room_ct_data = this._res._ctData.subarray(CT_RIGHT_ROOM)
            next_room = room_ct_data[pge.room_location]
            if (next_room < 0) {
                return 1
            }
            room_ct_data = room_ct_data.subarray(pge_grid_x - 16 + pge_grid_y * 16 + next_room * 0x70)
            return room_ct_data[0x80]
        } else if (pge_grid_y < 1) {
            room_ct_data = this._res._ctData.subarray(CT_UP_ROOM)
            next_room = room_ct_data[pge.room_location]
            if (next_room < 0) {
                return 1
            }
            room_ct_data = room_ct_data.subarray(pge_grid_x + (pge_grid_y + 6) * 16 + next_room * 0x70)
            return room_ct_data[0x100]
        } else if (pge_grid_y >= 7) {
            room_ct_data = this._res._ctData.subarray(CT_DOWN_ROOM)
            next_room = room_ct_data[pge.room_location]
            if (next_room < 0) {
                return 1
            }

            room_ct_data = room_ct_data.subarray(pge_grid_x + (pge_grid_y - 6) * 16 + next_room * 0x70)
            return room_ct_data[0xC0]
        } else {
            room_ct_data = this._res._ctData.subarray(0x100)
            room_ct_data = room_ct_data.subarray(pge_grid_x + pge_grid_y * 16 + pge.room_location * 0x70)
            return room_ct_data[0]
        }
    }

    col_getGridPos(pge: LivePGE, dx: number) {
        let x = pge.pos_x + dx
        let y = pge.pos_y

        let c = pge.room_location
        if (c < 0) return 0xFFFF
    
        if (x < 0) {
            c = this._res._ctData[CT_LEFT_ROOM + c]
            if (c < 0) return 0xFFFF
            x += 256
        } else if (x >= 256) {
            c = this._res._ctData[CT_RIGHT_ROOM + c]
            if (c < 0) return 0xFFFF
            x -= 256
        } else if (y < 0) {
            c = this._res._ctData[CT_UP_ROOM + c]
            if (c < 0) return 0xFFFF
            y += 216
        } else if (y >= 216) {
            c = this._res._ctData[CT_DOWN_ROOM + c]
            if (c < 0) return 0xFFFF
            y -= 216
        }

        x = (x + 8) >> 4
        y = ((y - 8) / 72) >> 0

        this.renders > this.debugStartFrame && console.log(`getGridPos x=${x} y=${y}`)

        if (x < 0 || x > 15 || y < 0 || y > 2) {
            return 0xFFFF
        } else {
            return y * 16 + x + c * 64
        }
    }

    col_preparePiegeState(pge: LivePGE) {
        let ct_slot1: CollisionSlot
        let ct_slot2: CollisionSlot
        if (pge.init_PGE.unk1C === 0) {
            pge.collision_slot = 0xFF
            return
        }
        let i = 0
        ct_slot1 = null
        for (let c = 0; c < pge.init_PGE.unk1C; ++c) {
            ct_slot2 = this._col_curSlot
            const nextIndex = this._col_slots.findIndex((el) => el === ct_slot2) + 1

            this._col_curSlot = this._col_slots[nextIndex]
            const pos = this.col_getGridPos(pge, i)
            if (c < 3) {
                this.renders > this.debugStartFrame && console.log(`gridPos = ${pos}`)
            }
            if (pos < 0) {
                if (ct_slot1 === null) {
                    pge.collision_slot = 0xFF
                } else {
                    ct_slot1.index = 0xFFFF
                }
                return
            }
            ct_slot2.ct_pos = pos
            ct_slot2.live_pge = pge
            ct_slot2.index = 0xFFFF
            const _ax = this.col_findSlot(pos)
            if (c < 3) {
                this.renders > this.debugStartFrame && console.log(`_ax=${_ax}`)
            }
            if (_ax >= 0) {
                ct_slot2.prev_slot = this._col_slotsTable[_ax]
                this._col_slotsTable[_ax] = ct_slot2
                if (ct_slot1 === null) {
                    // int16 -> uint8
                    pge.collision_slot = _ax & 0x00FF
                } else {
                    ct_slot1.index = _ax
                }
                let temp_pge = ct_slot2.live_pge
                if (temp_pge.flags & 0x80) {
                    this._pge_liveTable2[temp_pge.index] = temp_pge
                    temp_pge.flags |= 4
                }
                if (ct_slot2.prev_slot) {
                    temp_pge = ct_slot2.prev_slot.live_pge
                    if (temp_pge.flags & 0x80) {
                        this._pge_liveTable2[temp_pge.index] = temp_pge
                        temp_pge.flags |= 4
                    }
                }
            } else {
                ct_slot2.prev_slot = null
                this._col_slotsTable[this._col_curPos] = ct_slot2
                if (ct_slot1 == null) {
                    pge.collision_slot = this._col_curPos
                } else {
                    ct_slot1.index = this._col_curPos
                }
                this._col_curPos++
            }
            ct_slot1 = ct_slot2
            i += 0x10
        }
    }

    pge_prepare() {
        this.col_clearState()
        if (!(this._currentRoom & 0x80)) {
            let pge: LivePGE = this._pge_liveTable1[this._currentRoom]
            let i = 0
            while (pge) {
                this.col_preparePiegeState(pge)
                if (!(pge.flags & 4) && (pge.init_PGE.flags & 4)) {
                    this._pge_liveTable2[pge.index] = pge
                    pge.flags |= 4
                }
                pge = pge.next_PGE_in_room
                i++
            }
        }

        for (let i = 0; i < this._res._pgeNum; ++i) {
            const pge: LivePGE = this._pge_liveTable2[i]
            if (pge && this._currentRoom !== pge.room_location) {
                this.col_preparePiegeState(pge)
            }
        }
    }

    async pge_getInput() {
        await this.inp_update()
        this._inp_lastKeysHit = this._stub._pi.dirMask
        if ((this._inp_lastKeysHit & 0xC) && (this._inp_lastKeysHit & 0x3)) {
            const mask = (this._inp_lastKeysHit & 0xF0) | (this._inp_lastKeysHitLeftRight & 0xF)
            this._pge_inpKeysMask = mask
            this._inp_lastKeysHit = mask
        } else {
            this._pge_inpKeysMask = this._inp_lastKeysHit
            this._inp_lastKeysHitLeftRight = this._inp_lastKeysHit
        }
        if (this._stub._pi.enter) {
            this._pge_inpKeysMask |= 0x10
        }
        if (this._stub._pi.space) {
            this._pge_inpKeysMask |= 0x20
        }
        if (this._stub._pi.shift) {
            this._pge_inpKeysMask |= 0x40
        }
    }

    resetGameState() {
        this._animBuffers._states[0] = this._animBuffer0State
        this._animBuffers._curPos[0] = 0xFF
        this._animBuffers._states[1] = this._animBuffer1State
        this._animBuffers._curPos[1] = 0xFF
        this._animBuffers._states[2] = this._animBuffer2State
        this._animBuffers._curPos[2] = 0xFF
        this._animBuffers._states[3] = this._animBuffer3State
        this._animBuffers._curPos[3] = 0xFF
        this._currentRoom = this._res._pgeInit[0].init_room

        this._cut._deathCutsceneId = 0xFFFF
        this._pge_opTempVar2 = 0xFFFF
        this._deathCutsceneCounter = 0
        this._saveStateCompleted = false
        this._loadMap = true
        this.pge_resetGroups()
        this._blinkingConradCounter = 0
        this._pge_processOBJ = false
        this._pge_opTempVar1 = 0
        this._textToDisplay = 0xFFFF
    }

    async loadMonsterSprites(pge: LivePGE) {
        const init_pge: InitPGE = pge.init_PGE
        if (init_pge.obj_node_number !== 0x49 && init_pge.object_type !== 10) {
            debugger
            return 0xFFFF
        }
        if (init_pge.obj_node_number === this._curMonsterFrame) {
            return 0xFFFF
        }
        if (pge.room_location !== this._currentRoom) {
            return 0
        }
    
        let index = this._currentLevel
        const mList = _monsterListLevels[index]

        while (mList[index] !== init_pge.obj_node_number) {
            if (mList[index] === 0xFF) { // end of list
                return 0
            }
            index += 2
        }
        this._curMonsterFrame = mList[0 + index]
        if (this._curMonsterNum != mList[1 + index]) {
            this._curMonsterNum = mList[1 + index];
            switch (this._res._type) {
            case ResourceType.kResourceTypeAmiga: {
                    await this._res.load(Game._monsterNames[1][this._curMonsterNum], ObjectType.OT_SPM)
                    const tab: number[] = [ 0, 8, 0, 8 ]
                    const offset = this._vid._mapPalSlot3 * 16 + tab[this._curMonsterNum]
                    for (let i = 0; i < 8; ++i) {
                        this._vid.setPaletteColorBE(0x50 + i, offset + i)
                    }
                }
                break;
            case ResourceType.kResourceTypeDOS: {
                    const name = Game._monsterNames[0][this._curMonsterNum]
                    await this._res.load(name, ObjectType.OT_SPRM)
                    await this._res.load_SPR_OFF(name, this._res._sprm)
                    this._vid.setPaletteSlotLE(5, Game._monsterPals[this._curMonsterNum])
                }
                break;
            case ResourceType.kResourceTypeMac: {
                    const palette: Color[] = new Array(256)
                    await this._res.MAC_loadMonsterData(Game._monsterNames[0][this._curMonsterNum], palette)
                    const kMonsterPalette = 5
                    for (let i = 0; i < 16; ++i) {
                        const color = kMonsterPalette * 16 + i
                        this._stub.setPaletteEntry(color, palette[color])
                    }
                }
                break
            }
        }
        return 0xFFFF
    }

    hasLevelMap(level: number, room: number) {
        if (this._res._type === ResourceType.kResourceTypeMac) {
            return this._res.MAC_hasLevelMap(level, room)
        }
        if (this._res._map) {
            return READ_LE_UINT32(this._res._map, room * 6) !== 0
        } else if (this._res._lev) {
            return READ_BE_UINT32(this._res._lev,  room * 4) !== 0
        }
        return false
    }

    async loadLevelMap() {
        let widescreenUpdated = false
        this._currentIcon = 0xFF
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            if (this._currentLevel === 1) {
                let num = 0
                switch (this._currentRoom) {
                case 14:
                case 19:
                case 52:
                case 53:
                    num = 1
                    break
                case 11:
                case 24:
                case 27:
                case 56:
                    num = 2
                    break
                }
                if (num !== 0 && this._res._levNum !== num) {
                    const name = 'level2_' + num
                    await this._res.load(name, ObjectType.OT_LEV)
                    this._res._levNum = num
                }
            }
            this._vid.AMIGA_decodeLev(this._currentLevel, this._currentRoom)
            break
        case ResourceType.kResourceTypeDOS:
            if (this._stub.hasWidescreen() && this._widescreenMode === WidescreenMode.kWidescreenAdjacentRooms) {
                debugger
                const leftRoom = this._res._ctData[CT_LEFT_ROOM + this._currentRoom]
                if (leftRoom > 0 && this.hasLevelMap(this._currentLevel, leftRoom)) {
                    this._vid.PC_decodeMap(this._currentLevel, leftRoom)
                    this._stub.copyWidescreenLeft(Video.GAMESCREEN_W, Video.GAMESCREEN_H, this._vid._backLayer)
                } else {
                    this._stub.copyWidescreenLeft(Video.GAMESCREEN_W, Video.GAMESCREEN_H, null)
                }
                const rightRoom = this._res._ctData[CT_RIGHT_ROOM + this._currentRoom]
                if (rightRoom > 0 && this.hasLevelMap(this._currentLevel, rightRoom)) {
                    this._vid.PC_decodeMap(this._currentLevel, rightRoom)
                    this._stub.copyWidescreenRight(Video.GAMESCREEN_W, Video.GAMESCREEN_H, this._vid._backLayer)
                } else {
                    this._stub.copyWidescreenRight(Video.GAMESCREEN_W, Video.GAMESCREEN_H, null)
                }
                widescreenUpdated = true
            }
            this._vid.PC_decodeMap(this._currentLevel, this._currentRoom)
            break
        case ResourceType.kResourceTypeMac:
            if (this._stub.hasWidescreen() && this._widescreenMode == WidescreenMode.kWidescreenAdjacentRooms) {
                const leftRoom = this._res._ctData[CT_LEFT_ROOM + this._currentRoom]
                if (leftRoom > 0 && this.hasLevelMap(this._currentLevel, leftRoom)) {
                    this._vid.MAC_decodeMap(this._currentLevel, leftRoom)
                    this._stub.copyWidescreenLeft(this._vid._w, this._vid._h, this._vid._backLayer)
                } else {
                    this._stub.copyWidescreenLeft(this._vid._w, this._vid._h, null)
                }
                const rightRoom = this._res._ctData[CT_RIGHT_ROOM + this._currentRoom]
                if (rightRoom > 0 && this.hasLevelMap(this._currentLevel, rightRoom)) {
                    this._vid.MAC_decodeMap(this._currentLevel, rightRoom)
                    this._stub.copyWidescreenRight(this._vid._w, this._vid._h, this._vid._backLayer)
                } else {
                    this._stub.copyWidescreenRight(this._vid._w, this._vid._h, null)
                }
                widescreenUpdated = true
            }
            this._vid.MAC_decodeMap(this._currentLevel, this._currentRoom)
            break
        }
        if (!widescreenUpdated) {
            this._vid.updateWidescreen()
        }
    }

    async loadLevelData() {
        this._res.clearLevelRes()
        const lvl = _gameLevels[this._currentLevel]
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            if (this._res._isDemo) {
                const fname1 = "demo"
                const fname2 = "demof"
                await this._res.load(fname1, ObjectType.OT_MBK)
                await this._res.load(fname1, ObjectType.OT_CT)
                await this._res.load(fname1, ObjectType.OT_PAL)
                await this._res.load(fname1, ObjectType.OT_RPC)
                await this._res.load(fname1, ObjectType.OT_SPC)
                await this._res.load(fname1, ObjectType.OT_LEV)
                await this._res.load(fname2, ObjectType.OT_PGE)
                await this._res.load(fname1, ObjectType.OT_OBJ)
                await this._res.load(fname1, ObjectType.OT_ANI)
                await this._res.load(fname2, ObjectType.OT_TBN)
                await this._res.load_SPL_demo()
                await this._res.load("level1", ObjectType.OT_SGD)
                break
            }
            {
                let name = lvl.nameAmiga
                if (this._currentLevel === 4) {
                    name = _gameLevels[3].nameAmiga
                }
                await this._res.load(name, ObjectType.OT_MBK)
                if (this._currentLevel === 6) {
                    await this._res.load(_gameLevels[5].nameAmiga, ObjectType.OT_CT)
                } else {
                    await this._res.load(name, ObjectType.OT_CT)
                }
                await this._res.load(name, ObjectType.OT_PAL)
                await this._res.load(name, ObjectType.OT_RPC)
                await this._res.load(name, ObjectType.OT_SPC)
                if (this._currentLevel === 1) {
                    await this._res.load("level2_1", ObjectType.OT_LEV)
                    this._res._levNum = 1
                } else {
                    await this._res.load(name, ObjectType.OT_LEV)
                }
            }
            await this._res.load(lvl.nameAmiga, ObjectType.OT_PGE)
            await this._res.load(lvl.nameAmiga, ObjectType.OT_OBC)
            await this._res.load(lvl.nameAmiga, ObjectType.OT_ANI)
            await this._res.load(lvl.nameAmiga, ObjectType.OT_TBN)
            {
                let name = "level" + lvl.sound
                await this._res.load(name, ObjectType.OT_SPL)
            }
            if (this._currentLevel === 0) {
                await this._res.load(lvl.nameAmiga, ObjectType.OT_SGD)
            }
            break
        case ResourceType.kResourceTypeDOS:
            await this._res.load(lvl.name, ObjectType.OT_MBK)
            await this._res.load(lvl.name, ObjectType.OT_CT)
            await this._res.load(lvl.name, ObjectType.OT_PAL)
            await this._res.load(lvl.name, ObjectType.OT_RP)
            if (this._res._isDemo || g_options.use_tile_data) { // use .BNQ/.LEV/(.SGD) instead of .MAP (PC demo)
                if (this._currentLevel === 0) {
                    await this._res.load(lvl.name, ObjectType.OT_SGD)
                }
                await this._res.load(lvl.name, ObjectType.OT_LEV)
                await this._res.load(lvl.name, ObjectType.OT_BNQ)
            } else {
                await this._res.load(lvl.name, ObjectType.OT_MAP)
            }
            await this._res.load(lvl.name2, ObjectType.OT_PGE)
            await this._res.load(lvl.name2, ObjectType.OT_OBJ)
            await this._res.load(lvl.name2, ObjectType.OT_ANI)
            await this._res.load(lvl.name2, ObjectType.OT_TBN)
            break
        case ResourceType.kResourceTypeMac:
            // TODO
            debugger
            break
        }

        this._cut._id = lvl.cutscene_id
        if (this._res._isDemo && this._currentLevel === 5) { // PC demo does not include TELEPORT.*
            this._cut._id = 0xFFFF
        }

        this._curMonsterNum = 0xFFFF
        this._curMonsterFrame = 0
    
        this._res.clearBankData()
        this._printLevelCodeCounter = 150

        this._col_slots2Cur = this._col_slots2[0]
        this._col_slots2Next = null

        this._pge_liveTable1.fill(null).map(() => CreatePGE())
        this._pge_liveTable2.fill(null).map(() => CreatePGE())
    
        this._currentRoom = this._res._pgeInit[0].init_room
        let n = this._res._pgeNum

        while (n--) {
            this.pge_loadForCurrentLevel(n)
        }

        if (this._demoBin !== -1) {
            this._cut._id = -1
            if (_demoInputs[this._demoBin].room !== 255) {
                this._pgeLive[0].room_location = _demoInputs[this._demoBin].room
                this._pgeLive[0].pos_x = _demoInputs[this._demoBin].x
                this._pgeLive[0].pos_y = _demoInputs[this._demoBin].y
                this._inp_demPos = 0
            } else {
                this._inp_demPos = 1
            }
            this._printLevelCodeCounter = 0
        }

        for (let i = 0; i < this._res._pgeNum; ++i) {
            if (this._res._pgeInit[i].skill <= this._skillLevel) {
                this.renders > this.debugStartFrame && console.log(`i=${i} => skill!`)
                const pge = this._pgeLive[i]
                pge.next_PGE_in_room = this._pge_liveTable1[pge.room_location]
                this._pge_liveTable1[pge.room_location] = pge
            }
        }

        this.pge_resetGroups()
        this._validSaveState = false
    
        this._mix.playMusic(Mixer.MUSIC_TRACK + lvl.track)
    }

    pge_resetGroups() {
        this._pge_groupsTable.fill(null)
        let index = 0
        let le = this._pge_groups[index]
        this._pge_nextFreeGroup = le
        let n = 0xFF
        while (n--) {
            le.next_entry = this._pge_groups[index + 1]
            le.index = 0;
            le.group_id = 0
            index++
            le = this._pge_groups[index]
        }
        le.next_entry = null
        le.index = 0
        le.group_id = 0
    }

    clearStateRewind() {
        for (let i = 0; i < this._rewindLen; ++i) {
            let ptr = this._rewindPtr - i
            if (ptr < 0) {
                ptr += kRewindSize
            }
            this._rewindBuffer[ptr].close()
        }
        this._rewindPtr = -1
        this._rewindLen = 0
    }
}

export { Game, CT_UP_ROOM, CT_DOWN_ROOM, CT_RIGHT_ROOM, CT_LEFT_ROOM }
export type { col_Callback1, col_Callback2 }
