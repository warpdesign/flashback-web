import { Buffer, Language, ResourceType, Skill } from "./intern"
import { LocaleData, Resource } from "./resource"
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, SystemStub } from "./systemstub_web"
import { Video } from "./video"
import { _flagDe16x12, _flagEn16x12, _flagFr16x12, _flagIt16x12, _flagJp16x12, _flagSp16x12, _levelNames, _passwordsDOS, _passwordsEnAmiga, _passwordsFrAmiga, _passwordsMac } from './staticres'
import { g_options } from './config'
import { dump } from "./util"

const SCREEN_TITLE = 0
const SCREEN_SKILL = 1
const SCREEN_PASSWORD = 2
const SCREEN_LEVEL = 3
const SCREEN_INFO = 4

const EVENTS_DELAY = 80

interface Item {
    str: number
    opt: number
}

class Menu {
    static kMacTitleScreen_MacPlay = 1
    static kMacTitleScreen_Presage = 2
    static kMacTitleScreen_Flashback = 3
    static kMacTitleScreen_LeftEye = 4
    static kMacTitleScreen_RightEye = 5
    static kMacTitleScreen_Controls = 6

    static MENU_OPTION_ITEM_START = 0
    static MENU_OPTION_ITEM_SKILL = 1
    static MENU_OPTION_ITEM_PASSWORD= 2
    static MENU_OPTION_ITEM_LEVEL = 3
    static MENU_OPTION_ITEM_INFO = 4
    static MENU_OPTION_ITEM_DEMO = 5
    static MENU_OPTION_ITEM_QUIT = 6

    static _levelNames: string[] = _levelNames
    static _passwordsDOS: string[] = _passwordsDOS
    static _passwordsFrAmiga: string[] = _passwordsFrAmiga
    static _passwordsEnAmiga: string[] = _passwordsEnAmiga
    static _passwordsMac: string[] = _passwordsMac

    static _flagEn16x12: Uint8Array = _flagEn16x12
    static _flagFr16x12: Uint8Array = _flagFr16x12
    static _flagDe16x12: Uint8Array = _flagDe16x12
    static _flagIt16x12: Uint8Array = _flagIt16x12
    static _flagJp16x12: Uint8Array = _flagJp16x12
    static _flagSp16x12: Uint8Array = _flagSp16x12

    _res: Resource
    _stub: SystemStub
    _vid: Video

    _currentScreen: number
    _nextScreen: number
    _selectedOption: number

    _skill: number
    _level: number

    _charVar1: number
    _charVar2: number
    _charVar3: number
    _charVar4: number
    _charVar5: number

    constructor(res: Resource, stub: SystemStub, vid: Video) {
        this._res = res
        this._stub = stub
        this._vid = vid
        this._skill = Skill.kSkillNormal
        this._level = 0
    }

    async handleTitleScreen() {
        this._charVar1 = 0
        this._charVar2 = 0
        this._charVar3 = 0
        this._charVar4 = 0
        this._charVar5 = 0
    
        const MAX_MENU_ITEMS = 6
        const menuItems:Item[] = new Array(MAX_MENU_ITEMS).fill(null).map(() => ({
            str: 0,
            opt: 0,
        }))
        let menuItemsCount = 0
    
        menuItems[menuItemsCount].str = LocaleData.Id.LI_07_START
        menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_START
        ++menuItemsCount
        if (!this._res._isDemo) {
            debugger
            if (g_options.enable_password_menu) {
                menuItems[menuItemsCount].str = LocaleData.Id.LI_08_SKILL
                menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_SKILL
                ++menuItemsCount
                menuItems[menuItemsCount].str = LocaleData.Id.LI_09_PASSWORD
                menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_PASSWORD
                ++menuItemsCount
            } else {
                menuItems[menuItemsCount].str = LocaleData.Id.LI_06_LEVEL
                menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_LEVEL
                ++menuItemsCount
            }
        }
        menuItems[menuItemsCount].str = LocaleData.Id.LI_10_INFO
        menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_INFO
        ++menuItemsCount
        menuItems[menuItemsCount].str = LocaleData.Id.LI_23_DEMO
        menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_DEMO
        ++menuItemsCount
        menuItems[menuItemsCount].str = LocaleData.Id.LI_11_QUIT
        menuItems[menuItemsCount].opt = Menu.MENU_OPTION_ITEM_QUIT
        ++menuItemsCount
    
        this._selectedOption = -1
        this._currentScreen = -1
        this._nextScreen = SCREEN_TITLE
    
        let quitLoop = false
        let currentEntry = 0

        const languages: {
            lang: Language;
            bitmap16x12: Uint8Array;
        }[] = [
            { lang: Language.LANG_EN, bitmap16x12: Menu._flagEn16x12 },
            { lang: Language.LANG_FR, bitmap16x12: Menu._flagFr16x12 },
            { lang: Language.LANG_DE, bitmap16x12: Menu._flagDe16x12 },
            { lang: Language.LANG_SP, bitmap16x12: Menu._flagSp16x12 },
            { lang: Language.LANG_IT, bitmap16x12: Menu._flagIt16x12 },
            { lang: Language.LANG_JP, bitmap16x12: Menu._flagJp16x12 },
        ]
        let currentLanguage = 0
        for (let i = 0; i < languages.length; ++i) {
            if (languages[i].lang === this._res._lang) {
                currentLanguage = i
                break
            }
        }
    
        while (!quitLoop && !this._stub._pi.quit) {
    
            let selectedItem = -1
            let previousLanguage = currentLanguage
    
            if (this._nextScreen === SCREEN_TITLE) {
                await this._vid.fadeOut()
                await this.loadPicture("menu1")
                this._vid.fullRefresh()
                this._charVar3 = 1
                this._charVar4 = 2
                currentEntry = 0
                this._currentScreen = this._nextScreen
                this._nextScreen = -1
            }

            if (g_options.enable_language_selection) {
                if (this._stub._pi.dirMask & DIR_LEFT) {
                    this._stub._pi.dirMask &= ~DIR_LEFT;
                    if (currentLanguage !== 0) {
                        --currentLanguage
                    } else {
                        currentLanguage = languages.length - 1
                    }
                }
                if (this._stub._pi.dirMask & DIR_RIGHT) {
                    this._stub._pi.dirMask &= ~DIR_RIGHT;
                    if (currentLanguage !== languages.length - 1) {
                        ++currentLanguage
                    } else {
                        currentLanguage = 0
                    }
                }
            }

            if (this._stub._pi.dirMask & DIR_UP) {
                this._stub._pi.dirMask &= ~DIR_UP
                if (currentEntry !== 0) {
                    --currentEntry
                } else {
                    currentEntry = menuItemsCount - 1
                }
            }
            if (this._stub._pi.dirMask & DIR_DOWN) {
                this._stub._pi.dirMask &= ~DIR_DOWN
                if (currentEntry !== menuItemsCount - 1) {
                    ++currentEntry
                } else {
                    currentEntry = 0
                }
            }
            if (this._stub._pi.enter) {
                this._stub._pi.enter = false
                selectedItem = currentEntry
            }
            if (selectedItem !== -1) {
                this._selectedOption = menuItems[selectedItem].opt
                switch (this._selectedOption) {
                case Menu.MENU_OPTION_ITEM_START:
                    quitLoop = true
                    break
                case Menu.MENU_OPTION_ITEM_SKILL:
                    this._currentScreen = SCREEN_SKILL
                    // TODO
                    debugger
                    // this.handleSkillScreen()
                    break
                case Menu.MENU_OPTION_ITEM_PASSWORD:
                    debugger
                    this._currentScreen = SCREEN_PASSWORD
                    quitLoop = this.handlePasswordScreen()
                    break
                case Menu.MENU_OPTION_ITEM_LEVEL:
                    // TODO
                    this._currentScreen = SCREEN_LEVEL
                    quitLoop = this.handleLevelScreen()
                    break
                case Menu.MENU_OPTION_ITEM_INFO:
                    this._currentScreen = SCREEN_INFO
                    await this.handleInfoScreen()
                    break
                case Menu.MENU_OPTION_ITEM_DEMO:
                    quitLoop = true
                    break
                case Menu.MENU_OPTION_ITEM_QUIT:
                    quitLoop = true
                    break
                }
                this._nextScreen = SCREEN_TITLE
                continue
            }
    
            if (previousLanguage !== currentLanguage) {
                await this._res.setLanguage(languages[currentLanguage].lang)
                // clear previous language text
                this._vid._frontLayer.set(this._vid._backLayer.subarray(0, this._vid._layerSize))
            }

            // draw the options
            const yPos = 26 - menuItemsCount * 2
            for (let i = 0; i < menuItemsCount; ++i) {
                this.drawString(this._res.getMenuString(menuItems[i].str), yPos + i * 2, 20, (i === currentEntry) ? 2 : 3);
            }
    
            // draw the language flag in the top right corner
            if (previousLanguage !== currentLanguage) {
                this._stub.copyRect(0, 0, Video.GAMESCREEN_W, Video.GAMESCREEN_H, this._vid._frontLayer, Video.GAMESCREEN_W)
                const flagW = 16
                const flagH = 12
                const flagX = Video.GAMESCREEN_W - flagW - 8
                const flagY = 8
                this._stub.copyRectRgb24(flagX, flagY, flagW, flagH, languages[currentLanguage].bitmap16x12)
            }
            await this._vid.updateScreen()
            await this._stub.sleep(EVENTS_DELAY)
            await this._stub.processEvents()
        }
    }

    handlePasswordScreen() {
        // TODO
        debugger
        return true
    }

    async handleInfoScreen() {
        this._vid.fadeOut()
        if (this._res._lang === Language.LANG_FR) {
            await this.loadPicture("instru_f")
        } else {
            await this.loadPicture("instru_e")
        }

        this._vid.fullRefresh()
        await this._vid.updateScreen(true)
        do {
            await this._stub.sleep(EVENTS_DELAY)
            await this._stub.processEvents()
            if (this._stub._pi.escape) {
                this._stub._pi.escape = false
                break
            }
            if (this._stub._pi.enter) {
                this._stub._pi.enter = false
                break
            }
        } while (!this._stub._pi.quit)
    }

    handleLevelScreen() {
        // TODO
        debugger
        return true        
    }

    drawString(str: string, y: number, x: number, color: number) {
        const v1b = this._vid._charFrontColor
        const v2b = this._vid._charTransparentColor
        const v3b = this._vid._charShadowColor

        switch (color) {
        case 0:
            this._vid._charFrontColor = this._charVar1
            this._vid._charTransparentColor = this._charVar2
            this._vid._charShadowColor = this._charVar2
            break;
        case 1:
            this._vid._charFrontColor = this._charVar2
            this._vid._charTransparentColor = this._charVar1
            this._vid._charShadowColor = this._charVar1
            break;
        case 2:
            this._vid._charFrontColor = this._charVar3
            this._vid._charTransparentColor = 0xFF
            this._vid._charShadowColor = this._charVar1
            break;
        case 3:
            this._vid._charFrontColor = this._charVar4
            this._vid._charTransparentColor = 0xFF
            this._vid._charShadowColor = this._charVar1
            break;
        case 4:
            this._vid._charFrontColor = this._charVar2
            this._vid._charTransparentColor = 0xFF
            this._vid._charShadowColor = this._charVar1
            break;
        case 5:
            this._vid._charFrontColor = this._charVar2
            this._vid._charTransparentColor = 0xFF
            this._vid._charShadowColor = this._charVar5
            break;
        }
    
        this.drawString2(str, y, x)
    
        this._vid._charFrontColor = v1b
        this._vid._charTransparentColor = v2b
        this._vid._charShadowColor = v3b
    }
    
    drawString2(str: string, y: number, x: number) {
        const w = Video.CHAR_W
        const h = Video.CHAR_H
        let len = 0
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            for (; str[len]; ++len) {
                this._vid.AMIGA_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + len), Video.CHAR_H * y, this._res._fnt, this._vid._charFrontColor, str.charCodeAt(len))
            }
            break
        case ResourceType.kResourceTypeDOS:
            for (; str[len]; ++len) {
                this._vid.PC_drawChar(str.charCodeAt(len), y, x + len, true)
            }
            break
        case ResourceType.kResourceTypeMac:
            debugger
            for (; str[len]; ++len) {
                this._vid.MAC_drawStringChar(this._vid._frontLayer, this._vid._w, Video.CHAR_W * (x + len), Video.CHAR_H * y, this._res._fnt, this._vid._charFrontColor, str.charCodeAt(len))
            }
            break;
        }
        this._vid.markBlockAsDirty(x * w, y * h, len * w, h, this._vid._layerScale)
    }

    async loadPicture(prefix: string) {
        const kPictureW = 256
        const kPictureH = 224
        await this._res.load_MAP_menu(prefix, this._res._scratchBuffer)
        for (let i = 0; i < 4; ++i) {
            for (let y = 0; y < kPictureH; ++y) {
                for (let x = 0; x < kPictureW / 4; ++x) {
                    this._vid._frontLayer[i + x * 4 + kPictureW * y] = this._res._scratchBuffer[0x3800 * i + x + 64 * y]
                }
            }
        }
        this._vid._backLayer.set(this._vid._frontLayer.subarray(0, this._vid._layerSize))
        await this._res.load_PAL_menu(prefix, this._res._scratchBuffer)
        this._stub.setPalette(this._res._scratchBuffer, 256)
        this._vid.updateWidescreen()
    }
    
    getLevelPassword(level: number, skill: number) {
        switch (this._res._type) {
        case ResourceType.kResourceTypeAmiga:
            if (level < 7) {
                if (this._res._lang === Language.LANG_FR) {
                    return _passwordsFrAmiga[skill * 7 + level]
                } else {
                    return _passwordsEnAmiga[skill * 7 + level]
                }
            }
            break
        case ResourceType.kResourceTypeMac:
            return _passwordsMac[skill * 8 + level]
        case ResourceType.kResourceTypeDOS:
            // default
            break
        }
        return _passwordsDOS[skill * 8 + level]
    }
}

export { Menu }
