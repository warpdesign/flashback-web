import { ResourceType, Language, Options, WidescreenMode } from './intern'
import { ScalerParameters, defaultScaleParameters, SystemStub } from './systemstub_web'
import { File, FILE } from './file'
import { FileSystem } from './fs'
import { Game } from './game'
import { DEFAULT_CONFIG, g_options } from './config'

const USAGE = "REminiscence - Flashback Interpreter\n\
Usage: %s [OPTIONS]...\n\
  --datapath=PATH   Path to data files (default 'DATA')\n\
  --savepath=PATH   Path to save files (default '.')\n\
  --levelnum=NUM    Start to level, bypass introduction\n\
  --fullscreen      Fullscreen display\n\
  --widescreen=MODE 16:9 display (adjacent,mirror,blur,none)\n\
  --scaler=NAME@X   Graphics scaler (default 'scale@3')\n\
  --language=LANG   Language (fr,en,de,sp,it,jp)\n\
  --autosave        Save game state automatically\n"

const detectVersion = async (fs: FileSystem): Promise<number> => {
    const table: {
        filename: string
        type: number
        name: string
    }[] = [
		{ filename: "DEMO_UK.ABA", type: ResourceType.kResourceTypeDOS, name: "DOS (Demo)" },
		{ filename: "INTRO.SEQ", type: ResourceType.kResourceTypeDOS, name: "DOS CD" },
		{ filename: "MENU1SSI.MAP", type: ResourceType.kResourceTypeDOS, name: "DOS SSI" },
		{ filename: "LEVEL1.MAP", type: ResourceType.kResourceTypeDOS, name: "DOS" },
		{ filename: "LEVEL1.BNQ", type: ResourceType.kResourceTypeDOS, name: "DOS (Demo)" },
		{ filename: "LEVEL1.LEV", type: ResourceType.kResourceTypeAmiga, name: "Amiga" },
		{ filename: "DEMO.LEV", type: ResourceType.kResourceTypeAmiga, name: "Amiga (Demo)" },
		{ filename: "FLASHBACK.BIN", type: ResourceType.kResourceTypeMac, name: "Macintosh" },
		{ filename: "FLASHBACK.RSRC", type: ResourceType.kResourceTypeMac, name: "Macintosh" }
    ]

	for (let i = 0; i < table.length; ++i) {
		const f: File = new File()
		if (await f.open(table[i].filename, "rb", fs)) {
			console.log(`Detected ${table[i].name} version`)
			return table[i].type;
		}
	}

    return -1
}

const detectLanguage = async (fs: FileSystem) => {
	const table: {
		filename: string
		language: Language
	}[] = [
		// PC
		{ filename: "ENGCINE.TXT", language: Language.LANG_EN },
		{ filename: "FR_CINE.TXT", language: Language.LANG_FR },
		{ filename: "GERCINE.TXT", language: Language.LANG_DE },
		{ filename: "SPACINE.TXT", language: Language.LANG_SP },
		{ filename: "ITACINE.TXT", language: Language.LANG_IT },
		// Amiga
		{ filename: "FRCINE.TXT", language: Language.LANG_FR },
	]
	for (let i = 0; table[i].filename; ++i) {
		const f: File = new File()
		if (await f.open(table[i].filename, "rb", fs)) {
			return table[i].language;
		}
	}
	console.warn("Unable to detect language, defaults to English");
	return Language.LANG_EN
}

const g_caption = "REminiscence"

const initOptions = async () => {
	g_options.bypass_protection = true
	g_options.enable_password_menu = false
	g_options.enable_language_selection = true
	g_options.fade_out_palette = false
	g_options.use_text_cutscenes = false
	g_options.use_seq_cutscenes = true
	g_options.use_words_protection = false
	g_options.use_white_tshirt = false
	g_options.play_asc_cutscene = true
	g_options.play_caillou_cutscene = true
	g_options.play_metro_cutscene = false
	g_options.play_serrure_cutscene = false
	g_options.play_carte_cutscene = false
	g_options.play_gamesaved_sound = false

	// const filename = "rs.cfg"
	// const fp = await FILE.fopen(filename, "rb")
	// if (fp) {
	// 	console.warn('Reading prefs file not supported yet')
	// }
}

const parseScaler = (name: string, scalerParameters: ScalerParameters) => {
	const split = name.split('@')
	if (split.length > 1) {
		scalerParameters.factor = Number(split[1])
	}
	scalerParameters.name = name
}

const parseWidescreen = (mode: string):WidescreenMode => {
	const modes:{
		name: string
		mode: WidescreenMode
	}[] = [
		{ name: "adjacent", mode: WidescreenMode.kWidescreenAdjacentRooms },
		{ name: "mirror", mode: WidescreenMode.kWidescreenMirrorRoom },
		{ name: "blur", mode: WidescreenMode.kWidescreenBlur },
		{ name: "none", mode: WidescreenMode.kWidescreenNone },
	]
	for (let i = 0; modes[i].name; ++i) {
		if (modes[i].name === mode) {
			return modes[i].mode
		}
	}
	console.warn(`Unhandled widecreen mode '${mode}', defaults to 16:9 blur`)
	return WidescreenMode.kWidescreenBlur
}

const main = async (config = DEFAULT_CONFIG ) => {
	let dataPath = "DATA"
	let savePath = "."
	let levelNum = 0
	let fullscreen = false
	let autoSave = false
	let widescreen:WidescreenMode = WidescreenMode.kWidescreenNone
	let scalerParameters:ScalerParameters = { ...defaultScaleParameters }
	let forcedLanguage = -1
	console.log({ scalerParameters })
	console.log({ config })

	dataPath = config.datapath || dataPath
	levelNum = config.levelnum

	// param 5
	parseScaler(config.scaler, scalerParameters)
	// param 6
	const languages: {
		lang: Language,
		str: string
	}[] = [
		{
			lang: Language.LANG_FR,
			str: 'FR',
		},
		{
			lang: Language.LANG_EN,
			str: 'EN',
		},
		{
			lang: Language.LANG_DE,
			str: 'DE',
		},
		{
			lang: Language.LANG_SP,
			str: 'SP',
		},
		{
			lang: Language.LANG_IT,
			str: 'IT',
		},
		{
			lang: Language.LANG_JP,
			str: 'JP',
		}
	]
	for (let i = 0; languages[i].str; ++i) {
		if (languages[i].str === config.language.toUpperCase()) {
			forcedLanguage = languages[i].lang
			break
		}
	}

	// param 7
	widescreen = parseWidescreen(config.widescreen)

	await initOptions()
	const fs = new FileSystem()
	await fs.setRootDirectory(dataPath)
	const version = await detectVersion(fs)
	if (version === -1) {
		throw('Unable to find data files, check that all required files are present')
	} else {
		console.log('version', version)
	}
	const language = forcedLanguage === -1 ? await detectLanguage(fs) : forcedLanguage
	const stub = new SystemStub()
	const g = new Game(stub, fs, savePath, levelNum, version, language, widescreen, autoSave)
	await stub.init(g_caption, g._vid._w, g._vid._h, fullscreen, widescreen, scalerParameters)
	await g.run()
}

document.getElementById('play').addEventListener('click', () => {
	document.querySelector('.intro').style.display = 'none'
	document.querySelector('.main').classList.add('visible')
	main()
})
