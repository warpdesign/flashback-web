import { Options } from './intern'

interface Config {
    datapath: string
    savepath: string
    levelnum: number
    fullscreen: false
    scaler: string
    language: string
    widescreen: string
    autosave: false
}

const DEFAULT_CONFIG = {
    // 'https://warpdesign.github.io/flashback-web/demo-data'
    datapath: 'https://warpdesign.fr/tests/fb',
    savepath: '',
    levelnum: 0,
    fullscreen: false,
    scaler: '',
    language: 'EN',
    widescreen: 'none',
    autosave: false,
}

const g_options: Options = {
	bypass_protection: true,
	enable_password_menu: false,
	enable_language_selection: false,
	fade_out_palette: true,
	use_tile_data: false,
	use_text_cutscenes: false,
	use_seq_cutscenes: true,
	use_words_protection: false,
	use_white_tshirt: false,
	play_asc_cutscene: true,
	play_caillou_cutscene: true,
	play_metro_cutscene: false,
	play_serrure_cutscene: false,
	play_carte_cutscene: false,
	play_gamesaved_sound: false,
}

export { Config, DEFAULT_CONFIG, g_options }
