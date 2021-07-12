import { CT_DOWN_ROOM, CT_LEFT_ROOM, CT_RIGHT_ROOM, CT_UP_ROOM, Game } from "./game"
import { Buffer, CollisionSlot, CollisionSlot2, GroupPGE, LivePGE, ObjectOpcodeArgs, pge_ZOrderCallback } from "./intern"
import { col_detectHit, col_detectHitCallback3, col_detectHitCallback1, col_detectHitCallback2, col_detectGunHitCallback2, col_detectGunHitCallback1, col_detectGunHit, col_detectGunHitCallback3, col_detectHitCallback4, col_detectHitCallback5 } from './collision'
import { dump } from "./util"

const pge_op_isInpUp = (args: ObjectOpcodeArgs, game: Game) => {
	if (1 === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpBackward = (args: ObjectOpcodeArgs, game: Game) => {
	let mask = 8 // right
	if (game._pge_currentPiegeFacingDir) {
		mask = 4 // left
	}
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpDown = (args: ObjectOpcodeArgs, game: Game) => {
	if (2 === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpForward = (args: ObjectOpcodeArgs, game: Game) => {
	let mask = 4
	if (game._pge_currentPiegeFacingDir) {
		mask = 8
	}
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpBackwardMod = (args: ObjectOpcodeArgs, game: Game) => {
	// assert(args->a < 3);
    if (args.a >= 3) {
        throw(`Assertion failed: ${args.a} < 3`)
    }
	let mask = Game._pge_modKeysTable[args.a]
	if (game._pge_currentPiegeFacingDir) {
		mask |= 4
	} else {
		mask |= 8
	}
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpDownMod = (args: ObjectOpcodeArgs, game: Game) => {
    if (args.a >= 3) {
        throw(`Assertion failed: ${args.a} < 3`)
    }
	//assert(args->a < 3);
	const mask = Game._pge_modKeysTable[args.a] | 2
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpForwardMod = (args: ObjectOpcodeArgs, game: Game) => {
    if (args.a >= 3) {
        throw(`Assertion failed: ${args.a} < 3`)
    }
	//assert(args->a < 3);
	let mask = Game._pge_modKeysTable[args.a]
	if (game._pge_currentPiegeFacingDir) {
		mask |= 8
	} else {
		mask |= 4
	}
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_isInpUpMod = (args: ObjectOpcodeArgs, game: Game) => {
	// assert(args->a < 3);
    if (args.a >= 3) {
        throw(`Assertion failed: ${args.a} < 3`)
    }
	const mask = Game._pge_modKeysTable[args.a] | 1
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_doesNotCollide1u = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 1, -args.a)
	if (r & 0xFFFF) {
		return 0;
	} else {
		return 0xFFFF
	}
}

const pge_op_doesNotCollide10 = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 1, 0)
	if (r & 0xFFFF) {
		return 0
	} else {
		return 0xFFFF
	}
}

const pge_op_doesNotCollide2u = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 2, -args.a)
	if (r & 0xFFFF) {
		return 0
	} else {
		return 0xFFFF
	}
}

const pge_op_doesNotCollide20 = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 2, 0)
	if (r & 0xFFFF) {
		return 0
	} else {
		return 0xFFFF
	}
}

const pge_op_isInpNoMod = (args: ObjectOpcodeArgs, game: Game) => {
	// assert(args->a < 3);
    if (args.a >= 3) {
        throw(`Assertion failed: ${args.a} < 3`)
    }
	const mask = Game._pge_modKeysTable[args.a]
	if (((game._pge_inpKeysMask & 0xF) | mask) === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_getCollision0u = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 0, -args.a)
}

const pge_op_getCollision00 = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 0, 0)
}

const pge_op_getCollision0d = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 0, args.a)
}

const pge_op_isInpIdle = (args: ObjectOpcodeArgs, game: Game) => {
	if (game._pge_inpKeysMask === 0) {
		return 0xFFFF
	} else {
		return 0
	}    
}

const pge_op_getCollision10 = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 1, 0)
}

const pge_op_getCollision1d = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 1, args.a)
}

const pge_op_getCollision2u = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 2, -args.a)
}

const pge_op_getCollision20 = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 2, 0)
}

const pge_op_getCollision2d = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 2, args.a)
}

const pge_op_doesNotCollide0u = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 0, -args.a)
	if (r & 0xFFFF) {
		return 0
	} else {
		return 0xFFFF
	}
}

const pge_op_doesNotCollide00 = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 0, 0)
	if (r & 0xFFFF) {
		return 0
	} else {
		return 0xFFFF
	}
}

const pge_op_doesNotCollide0d = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 0, args.a)
	if (r & 0xFFFF) {
		return 0
	} else {
		return 0xFFFF
	}
}

const pge_op_getCollision1u = (args: ObjectOpcodeArgs, game: Game) => {
	return game.col_getGridData(args.pge, 1, -args.a)
}

const pge_ZOrderByNumber = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	return 0
	// return pge1 - pge2
}

const pge_ZOrderIfIndex = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1.index !== comp2) {
		game.pge_updateGroup(pge2.index, pge1.index, comp)
		return 1
	}
	return 0
}

const pge_ZOrderIfSameDirection = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1 !== pge2) {
		if ((pge1.flags & 1) === (pge2.flags & 1)) {
			game._pge_compareVar2 = 1
			game.pge_updateGroup(pge2.index, pge1.index, comp)
			if (pge2.index === 0) {
				return 0xFFFF
			}
		}
	}
	return 0
}

const pge_ZOrderIfDifferentDirection = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1 !== pge2) {
		if ((pge1.flags & 1) !== (pge2.flags & 1)) {
			game._pge_compareVar1 = 1
			game.pge_updateGroup(pge2.index, pge1.index, comp)
			if (pge2.index === 0) {
				return 0xFFFF
			}
		}
	}
	return 0
}

const pge_ZOrderByAnimYIfType = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1.init_PGE.object_type === comp2) {
		if (game._res.getAniData(pge1.obj_type)[3] === comp) {
			return 1
		}
	}
	return 0
}

const pge_ZOrderByAnimY = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1 !== pge2) {
		if (game._res.getAniData(pge1.obj_type)[3] === comp) {
			return 1
		}
	}
	return 0
}

const pge_ZOrderByIndex = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1 !== pge2) {
		game.pge_updateGroup(pge2.index, pge1.index, comp)
		game._pge_compareVar1 = 0xFFFF
	}

	return 0
}

const pge_ZOrderByObj = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (comp === 10) {
		if (pge1.init_PGE.object_type === comp && pge1.life >= 0) {
			return 1
		}
	} else {
		if (pge1.init_PGE.object_type === comp) {
			return 1
		}
	}

	return 0
}

const pge_ZOrderIfTypeAndDifferentDirection = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1.init_PGE.object_type === comp) {
		if ((pge1.flags & 1) !== (pge2.flags & 1)) {
			return 1
		}
	}
	return 0
}

const pge_ZOrderIfTypeAndSameDirection = (pge1: LivePGE, pge2: LivePGE, comp: number, comp2: number, game: Game) => {
	if (pge1.init_PGE.object_type === comp) {
		if ((pge1.flags & 1) === (pge2.flags & 1)) {
			return 1
		}
	}
	return 0
}

const pge_ZOrder = (pge: LivePGE, num: number, compare: pge_ZOrderCallback, unk: number, game: Game) => {
	let slot = pge.collision_slot
	while (slot !== 0xFF) {
		let cs:CollisionSlot = game._col_slotsTable[slot]
		if (cs === null) {
			return 0
		}
		let slot_bak = slot
		slot = 0xFF
		while (cs !== null) {
			if (compare(cs.live_pge, pge, num, unk, game) !== 0) {
				return 1
			}
			if (pge === cs.live_pge) {
				slot = cs.index & 0x00FF
			}
			cs = cs.prev_slot
			if (slot === slot_bak) {
				return 0
			}
		}
	}
	return 0
}

const pge_updateCollisionState = (pge: LivePGE, pge_dy: number, var8: number, game: Game) => {
	let pge_unk1C = pge.init_PGE.unk1C
	if (!(pge.room_location & 0x80) && pge.room_location < 0x40) {
        const grid_data = game._res._ctData.subarray(0x100)
		let dataIndex = 0x70 * pge.room_location
		let pge_pos_y = (((pge.pos_y / 36)>>0) & ~1) + pge_dy
		let pge_pos_x = (pge.pos_x + 8) >> 4

		dataIndex += pge_pos_x + pge_pos_y * 16

		let slot1: CollisionSlot2 = game._col_slots2Next
		let i = 255
		pge_pos_x = i
		if (game._pge_currentPiegeFacingDir) {
			i = pge_unk1C - 1
			dataIndex -= i
		}
        let while_i = 0
		while (slot1) {
			if (slot1.unk2.buffer === grid_data.buffer && slot1.unk2.byteOffset === (grid_data.byteOffset + dataIndex)) {
				slot1.data_size = pge_unk1C - 1
                if (pge_unk1C >= 0x70) {
                    throw(`Assertion failed: ${pge_unk1C} < 0x70`)
                }
                grid_data.subarray(dataIndex).fill(var8, 0, pge_unk1C)
				dataIndex += pge_unk1C
				return 1
			} else {
				++i
				slot1 = slot1.next_slot
				if (--i === 0) {
					break
				}
			}
		}

        const slotIndex = game._col_slots2.findIndex((slot) => slot === game._col_slots2Cur)
		if (slotIndex < 255) {
			slot1 = game._col_slots2Cur
			slot1.unk2 = grid_data.subarray(dataIndex)
			slot1.data_size = pge_unk1C - 1
			const dst = slot1.data_buf
			const src = grid_data.subarray(dataIndex)
            let srcIndex = 0
            let dstIndex = 0
			let n = pge_unk1C
            if (n >= 0x10) {
                throw(`Assertion failed: ${n} < 0x10`)
            }
			while (n--) {
                // int8 -> uint8
				dst[dstIndex++] = src[srcIndex] & 0xFF
                // uint8 -> int8
				src[srcIndex++] = (var8 << 24 >> 24)
			}

            game._col_slots2Cur = game._col_slots2[slotIndex + 1]
			slot1.next_slot = game._col_slots2Next
			game._col_slots2Next = slot1
		}
	}
	return 1
}

const pge_op_nop = (args: ObjectOpcodeArgs, game: Game) => {
	return 1
}

const pge_op_pickupObject = (args:ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = game.col_findPiege(args.pge, 3)
	if (pge) {
		game.pge_updateGroup(args.pge.index, pge.index, args.a)
		return 0xFFFF
	}
	return 0
}

const pge_op_addItemToInventory = (args: ObjectOpcodeArgs, game: Game) => {
	game.pge_updateInventory(game._pgeLive[args.a], args.pge)
	args.pge.room_location = 0xFF
	return 0xFFFF
}

const pge_op_copyPiege = (args: ObjectOpcodeArgs, game: Game) => {
	const src:LivePGE = game._pgeLive[args.a]
	const dst:LivePGE = args.pge

	dst.pos_x = src.pos_x
	dst.pos_y = src.pos_y
	dst.room_location = src.room_location

	dst.flags &= 0xFE
	if (src.flags & 1) {
		dst.flags |= 1
	}
	game.pge_reorderInventory(args.pge)
	return 0xFFFF
}

const pge_op_canUseCurrentInventoryItem = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = game._pgeLive[0]
	if (pge.current_inventory_PGE !== 0xFF && game._res._pgeInit[pge.current_inventory_PGE].object_id === args.a) {
		return 1
	}

	return 0
}

const pge_op_removeItemFromInventory = (args: ObjectOpcodeArgs, game: Game) => {
	if (args.pge.current_inventory_PGE !== 0xFF) {
		game.pge_updateGroup(args.pge.index, args.pge.current_inventory_PGE, args.a)
	}

	return 1
}

const pge_o_unk0x3C = (args: ObjectOpcodeArgs, game: Game) => {
    return pge_ZOrder(args.pge, args.a, pge_ZOrderByAnimYIfType, args.b, game)
}

const pge_o_unk0x3D = (args: ObjectOpcodeArgs, game: Game) => {
	const res = pge_ZOrder(args.pge, args.a, pge_ZOrderByAnimY, 0, game)
    return res
}

const pge_op_setPiegeCounter = (args: ObjectOpcodeArgs, game: Game) => {
	args.pge.counter_value = args.a
	return 1
}

const pge_op_decPiegeCounter = (args: ObjectOpcodeArgs, game: Game) => {
	args.pge.counter_value -= 1
	if (args.a === args.pge.counter_value) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_o_unk0x40 = (args: ObjectOpcodeArgs, game: Game) => {
	let pge_room = args.pge.room_location
	if (pge_room < 0 || pge_room >= 0x40) {
        return 0
    }
	let col_area
	if (game._currentRoom === pge_room) {
		col_area = 1
	} else if (game._col_currentLeftRoom === pge_room) {
		col_area = 0
	} else if (game._col_currentRightRoom === pge_room) {
		col_area = 2
	} else {
		return 0
	}

	let grid_pos_x = (args.pge.pos_x + 8) >> 4
	let grid_pos_y = (args.pge.pos_y / 72) >> 0

	if (grid_pos_y >= 0 && grid_pos_y <= 2) {
		grid_pos_y *= 16
		let _cx = args.a
		if (game._pge_currentPiegeFacingDir) {
			_cx = -_cx
		}
		let _bl
		if (_cx >= 0) {
			if (_cx > 0x10) {
				_cx = 0x10
			}
            let var2 = new Int8Array(game._res._ctData.buffer)
            let var2Index = game._res._ctData.byteOffset + 0x100 + pge_room * 0x70 + grid_pos_y * 2 + 0x10 + grid_pos_x

            const var4 = new Uint8Array(game._col_activeCollisionSlots.buffer)
            let var4Index = game._col_activeCollisionSlots.byteOffset + col_area * 0x30 + grid_pos_y + grid_pos_x

			let var12 = grid_pos_x
			--_cx

			do {
				--var12
				if (var12 < 0) {
					--col_area
					if (col_area < 0) {
                        return 0
                    }
					pge_room = game._res._ctData[CT_LEFT_ROOM + pge_room]
					if (pge_room < 0) {
                        return 0
                    }
					var12 = 15
					var2 = new Int8Array(game._res._ctData.buffer)
                    var2Index = game._res._ctData.byteOffset + 0x101 + pge_room * 0x70 + grid_pos_y * 2 + 15 + 0x10

					var4Index = var4Index - 31
				}
				--var4Index
				_bl = var4[var4Index] << 24 >> 24

				if (_bl >= 0) {
					let col_slot:CollisionSlot = game._col_slotsTable[_bl]
					do {
						if (args.pge !== col_slot.live_pge && (col_slot.live_pge.flags & 4)) {
							if (col_slot.live_pge.init_PGE.object_type === args.b) {
								return 1
							}
						}
						col_slot = col_slot.prev_slot
					} while (col_slot)
				}
				--var2Index
				if (var2[var2Index] !== 0) {
                    return 0
                }
				--_cx;
			} while (_cx >= 0);
		} else {
			_cx = -_cx
			if (_cx > 0x10) {
				_cx = 0x10
			}

            let var2 = game._res._ctData.subarray(0x101 + pge_room * 0x70 + grid_pos_y * 2 + 0x10 + grid_pos_x)
			let var2Index = 0
            const var4 = new Uint8Array(game._col_activeCollisionSlots.buffer)
            let var4Index = game._col_activeCollisionSlots.byteOffset + 1 + col_area * 0x30 + grid_pos_y + grid_pos_x
            let var12 = grid_pos_x
			--_cx
			do {
				++var12
				if (var12 === 0x10) {
					++col_area
					if (col_area > 2) {
                        return 0
                    }
					pge_room = game._res._ctData[CT_RIGHT_ROOM + pge_room]
					if (pge_room < 0) {
                        return 0
                    }

					var12 = 0
					var2 = game._res._ctData.subarray(0x101 + pge_room * 0x70 + grid_pos_y * 2 + 0x10)
                    var2Index = 0
					var4Index += 32
				}
				var4Index++;
				_bl = var4[var4Index] << 24 >> 24
				if (_bl >= 0) {
					let col_slot:CollisionSlot = game._col_slotsTable[_bl]
					do {
						if (args.pge !== col_slot.live_pge && (col_slot.live_pge.flags & 4)) {
							if (col_slot.live_pge.init_PGE.object_type === args.b) {
								return 1
							}
						}
						col_slot = col_slot.prev_slot
					} while (col_slot)
				}
				_bl = var2[var2Index]
				++var2Index
				if (_bl !== 0) {
                    return 0
                }
				--_cx
			} while (_cx >= 0)
		}
	}

	return 0
}

const pge_op_wakeUpPiege = (args: ObjectOpcodeArgs, game: Game) => {
	if (args.a <= 3) {
		const num = args.pge.init_PGE.counter_values[args.a]
		if (num >= 0) {
			const pge: LivePGE = game._pgeLive[num]
			pge.flags |= 4
			game._pge_liveTable2[num] = pge
		}
	}
	return 1
}

const pge_op_removePiege = (args: ObjectOpcodeArgs, game: Game) => {
	if (args.a <= 3) {
		const num = args.pge.init_PGE.counter_values[args.a]
		if (num >= 0) {
			game._pge_liveTable2[num] = null
			game._pgeLive[num].flags &= ~4
		}
	}
	return 1
}

const pge_op_killPiege = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	pge.room_location = 0xFE
	pge.flags &= ~4
	game._pge_liveTable2[pge.index] = null
	if (pge.init_PGE.object_type === 10) {
		game._score += 200
	}

	return 0xFFFF
}

const pge_op_isInCurrentRoom = (args: ObjectOpcodeArgs, game: Game) => {
	return (args.pge.room_location === game._currentRoom) ? 1 : 0
}

const pge_op_isNotInCurrentRoom = (args: ObjectOpcodeArgs, game: Game) => {
	const res = (args.pge.room_location === game._currentRoom) ? 0 : 1
    return res
}

const pge_op_scrollPosY = (args: ObjectOpcodeArgs, game: Game) => {
	let pge: LivePGE = args.pge
	args.pge.pos_y += args.a
	let pge_num = pge.current_inventory_PGE
	while (pge_num !== 0xFF) {
		pge = game._pgeLive[pge_num]
		pge.pos_y += args.a
		pge_num = pge.next_inventory_PGE
	}
	return 1
}

const pge_op_playDefaultDeathCutscene = (args: ObjectOpcodeArgs, game: Game) => {
	if (game._deathCutsceneCounter === 0) {
		game._deathCutsceneCounter = args.a
	}
	return 1
}

const pge_op_isNotFacingConrad = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	const pge_conrad:LivePGE = game._pgeLive[0]
	if ((pge.pos_y / 72) >> 0 === ((pge_conrad.pos_y - 8) / 72) >> 0)  { // same grid cell
		if (pge.room_location === pge_conrad.room_location) {
			if (args.a === 0) {
				if (game._pge_currentPiegeFacingDir) {
					if (pge.pos_x < pge_conrad.pos_x) {
						return 0xFFFF
					}
				} else {
					if (pge.pos_x > pge_conrad.pos_x) {
						return 0xFFFF
					}
				}
			} else {
				let dx;
				if (game._pge_currentPiegeFacingDir) {
					dx = pge_conrad.pos_x - pge.pos_x
				} else {
					dx = pge.pos_x - pge_conrad.pos_x
				}
				if (dx > 0 && dx < args.a * 16) {
					return 0xFFFF
				}
			}
		} else if (args.a === 0) {
			if (!(pge.room_location & 0x80) && pge.room_location < 0x40) {
				if (game._pge_currentPiegeFacingDir) {
					if (pge_conrad.room_location === game._res._ctData[CT_RIGHT_ROOM + pge.room_location])
						return 0xFFFF
				} else {
					if (pge_conrad.room_location === game._res._ctData[CT_LEFT_ROOM + pge.room_location])
						return 0xFFFF
				}
			}
		}
	}
	return 0
}

const pge_op_isFacingConrad = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	const pge_conrad:LivePGE = game._pgeLive[0]
	if ((pge.pos_y / 72) >> 0 === ((pge_conrad.pos_y - 8) / 72) >> 0) {
		if (pge.room_location === pge_conrad.room_location) {
			if (args.a === 0) {
				if (game._pge_currentPiegeFacingDir) {
					if (pge.pos_x > pge_conrad.pos_x) {
						return 0xFFFF
					}
				} else {
					if (pge.pos_x <= pge_conrad.pos_x) {
						return 0xFFFF
					}
				}
			} else {
				let dx;
				if (game._pge_currentPiegeFacingDir) {
					dx = pge.pos_x - pge_conrad.pos_x
				} else {
					dx = pge_conrad.pos_x - pge.pos_x
				}
				if (dx > 0 && dx < args.a * 16) {
					return 0xFFFF
				}
			}
		} else if (args.a === 0) {
			if (!(pge.room_location & 0x80) && pge.room_location < 0x40) {
				if (game._pge_currentPiegeFacingDir) {
					if (pge_conrad.room_location === game._res._ctData[CT_LEFT_ROOM + pge.room_location])
						return 0xFFFF
				} else {
					if (pge_conrad.room_location === game._res._ctData[CT_RIGHT_ROOM + pge.room_location])
						return 0xFFFF
				}
			}

		}
	}

	return 0
}

const pge_o_unk0x7C = (args: ObjectOpcodeArgs, game: Game) => {
	let pge:LivePGE = game.col_findPiege(args.pge, 3)
	if (pge === null) {
		pge = game.col_findPiege(args.pge, 5)
		if (pge == null) {
			pge = game.col_findPiege(args.pge, 9)
			if (pge === null) {
				pge = game.col_findPiege(args.pge, 0xFFFF)
			}
		}
	}
	if (pge !== null) {
		game.pge_updateGroup(args.pge.index, pge.index, args.a)
	}
	return 0
}

const pge_op_playSound = (args: ObjectOpcodeArgs, game: Game) => {
	const sfxId = args.a & 0xFF
	const softVol = args.a >> 8
	game.playSound(sfxId, softVol)
	return 0xFFFF
}

const pge_o_unk0x7E = (args: ObjectOpcodeArgs, game: Game) => {
	game._pge_compareVar1 = 0
	pge_ZOrder(args.pge, args.a, pge_ZOrderByIndex, 0, game)
	return game._pge_compareVar1
}

const pge_op_hasInventoryItem = (args: ObjectOpcodeArgs, game: Game) => {
	let pge:LivePGE = game._pgeLive[0]
	let _dl = pge.current_inventory_PGE
	while (_dl !== 0xFF) {
		pge = game._pgeLive[_dl]
		if (pge.init_PGE.object_id === args.a) {
			return 0xFFFF
		}
		_dl = pge.next_inventory_PGE
	}
	return 0
}

const pge_op_updateGroup0 = (args: ObjectOpcodeArgs, game: Game) => {
	const pge: LivePGE = args.pge
	game.pge_updateGroup(pge.index, pge.init_PGE.counter_values[0], args.a)
	return 0xFFFF;
}

const pge_op_updateGroup1 = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	game.pge_updateGroup(pge.index, pge.init_PGE.counter_values[1], args.a)
	return 0xFFFF
}

const pge_op_updateGroup2 = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	game.pge_updateGroup(pge.index, pge.init_PGE.counter_values[2], args.a)
	return 0xFFFF
}

const pge_op_updateGroup3 = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	game.pge_updateGroup(pge.index, pge.init_PGE.counter_values[3], args.a)
	return 0xFFFF
}

const pge_op_isPiegeDead = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	if (pge.life <= 0) {
		if (pge.init_PGE.object_type === 10) {
			game._score += 100
		}
		return 1
	}

	return 0
}

const pge_op_collides1u2o = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 1, args.a - 1) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 2, args.a) === 0) {
			return 0xFFFF
		}
	}

	return 0
}

const pge_op_collides1u1o = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 1, args.a - 1) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 1, args.a) === 0) {
			return 0xFFFF
		}
	}

	return 0
}

const pge_op_collides1o1u = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 1, args.a - 1) === 0) {
		if (game.col_getGridData(args.pge, 1, args.a) & 0xFFFF) {
			return 0xFFFF
		}
	}

	return 0
}

const pge_o_unk0x2B = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_ZOrder(args.pge, args.a, pge_ZOrderIfTypeAndDifferentDirection, 0, game)
}

const pge_o_unk0x2C = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_ZOrder(args.pge, args.a, pge_ZOrderIfTypeAndSameDirection, 0, game)
}

const pge_o_unk0x2D = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_ZOrder(args.pge, args.a, pge_ZOrderByObj, 0, game) ^ 1
}

const pge_op_doesNotCollide2d = (args: ObjectOpcodeArgs, game: Game) => {
	const r = game.col_getGridData(args.pge, 2, args.a)
	if (r & 0xFFFF) {
		return 0;
	} else {
		return 0xFFFF;
	}
}

const pge_op_collides0o0d = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 0, args.a) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 0, args.a + 1) === 0) {
			if (game.col_getGridData(args.pge, -1, args.a) === 0) {
				return 0xFFFF
			}
		}
	}

	return 0
}

const pge_op_collides2o2d = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 2, args.a) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 2, args.a + 1) === 0) {
			if (game.col_getGridData(args.pge, 1, args.a) === 0) {
				return 0xFFFF
			}
		}
	}

	return 0
}

const pge_op_collides0o0u = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 0, args.a) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 0, args.a - 1) === 0) {
			if (game.col_getGridData(args.pge, -1, args.a) === 0) {
				return 0xFFFF
			}
		}
	}

	return 0
}

const pge_op_collides2o2u = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 2, args.a) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 2, args.a - 1) === 0) {
			if (game.col_getGridData(args.pge, 1, args.a) === 0) {
				return 0xFFFF
			}
		}
	}

	return 0
}

const pge_op_collides2u2o = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 2, args.a - 1) & 0xFFFF) {
		if (game.col_getGridData(args.pge, 2, args.a) === 0) {
			if (game.col_getGridData(args.pge, 1, args.a - 1) === 0) {
                return 0xFFFF
			}
		}
	}

	return 0
}

const pge_op_isInGroup = (args: ObjectOpcodeArgs, game: Game) => {
	let le:GroupPGE = game._pge_groupsTable[args.pge.index]
	while (le) {
		if (le.group_id === args.a) {
			return 0xFFFF
		}
		le = le.next_entry
	}

	return 0
}

const pge_o_unk0x50 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_ZOrder(args.pge, args.a, pge_ZOrderByObj, 0, game)
}

const pge_o_unk0x52 = (args: ObjectOpcodeArgs, game: Game) => {
	return col_detectHit(args.pge, args.a, args.b, col_detectHitCallback4, col_detectHitCallback1, 0, 0, game)
}

const pge_o_unk0x53 = (args: ObjectOpcodeArgs, game: Game) => {
	return col_detectHit(args.pge, args.a, args.b, col_detectHitCallback5, col_detectHitCallback1, 0, 0, game)
}

const pge_op_isPiegeNear = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_findPiege(game._pgeLive[0], args.a) !== null) {
		return 1
	}
	return 0
}

const pge_op_setLife = (args: ObjectOpcodeArgs, game: Game) => {
	args.pge.life = args.a
	return 1
}

const pge_op_incLife = (args: ObjectOpcodeArgs, game: Game) => {
	args.pge.life += args.a
	return 1
}

const pge_op_setPiegeDefaultAnim = (args: ObjectOpcodeArgs, game: Game) => {
	if (args.a < 0 || args.a >= 4) {
		throw(`Assertion failed: ${args.a} >= 0 && ${args.a} < 4`)
	}

	const r = args.pge.init_PGE.counter_values[args.a]
	args.pge.room_location = r
	if (r === 1) {
		// this happens after death tower, on earth, when Conrad passes
		// by the first policeman who's about to shoot him in the back
		game._loadMap = true;
	}
	game.pge_setupDefaultAnim(args.pge)
	return 1
}

const pge_o_unk0x34 = (args: ObjectOpcodeArgs, game: Game) => {
	const mask = (game._pge_inpKeysMask & 0xF) | Game._pge_modKeysTable[0]
	if (mask === game._pge_inpKeysMask) {
		if (game.col_getGridData(args.pge, 2, -args.a) === 0) {
			return 0xFFFF
		}
	}

	return 0
}

const pge_op_isInpMod = (args: ObjectOpcodeArgs, game: Game) => {
    if (args.a >= 3) {
        throw(`Assertion failed: ${args.a} < 3`)
    }
	const mask = Game._pge_modKeysTable[args.a]
	if (mask === game._pge_inpKeysMask) {
		return 0xFFFF
	} else {
		return 0
	}
}

const pge_op_setCollisionState1 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_updateCollisionState(args.pge, args.a, 1, game)
}

const pge_op_setCollisionState0 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_updateCollisionState(args.pge, args.a, 0, game)
}

const pge_isInGroup = (pge_dst: LivePGE, group_id: number, counter: number, game: Game) => {
	if (counter < 1 || counter > 4) {
		throw(`Assertion failed: ${counter} >= 1 1 && ${counter} <= 4`)
	}

	const c = pge_dst.init_PGE.counter_values[counter - 1]
	let le:GroupPGE = game._pge_groupsTable[pge_dst.index]
	while (le) {
		if (le.group_id === group_id && le.index === c)
			return 1
		le = le.next_entry
	}
	return 0
}

const pge_op_isInGroup1 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_isInGroup(args.pge, args.a, 1, game)
}

const pge_op_isInGroup2 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_isInGroup(args.pge, args.a, 2, game)
}

const pge_op_isInGroup3 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_isInGroup(args.pge, args.a, 3, game)
}

const pge_op_isInGroup4 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_isInGroup(args.pge, args.a, 4, game)
}

const pge_op_removePiegeIfNotNear = (args: ObjectOpcodeArgs, game: Game) => {
    const skip_pge = () => {
        game._pge_playAnimSound = false
        return 1
    }
    const kill_pge = () => {
        pge.flags &= ~4
        pge.collision_slot = 0xFF
        game._pge_liveTable2[pge.index] = null
        return skip_pge()
    }

	const pge: LivePGE = args.pge
	if (!(pge.init_PGE.flags & 4)) {
        return kill_pge()
    }
	if (game._currentRoom & 0x80) {
        return skip_pge()
    }
	if (pge.room_location & 0x80) {
        return kill_pge()
    }
	if (pge.room_location > 0x3F) {
        return kill_pge()
    }
	if (pge.room_location === game._currentRoom) {
        return skip_pge()
    }
	if (pge.room_location === game._res._ctData[CT_UP_ROOM + game._currentRoom]) {
        return skip_pge()
    }
	if (pge.room_location === game._res._ctData[CT_DOWN_ROOM + game._currentRoom]) {
        return skip_pge()
    }
	if (pge.room_location === game._res._ctData[CT_RIGHT_ROOM + game._currentRoom]) {
        return skip_pge()
    }
	if (pge.room_location === game._res._ctData[CT_LEFT_ROOM + game._currentRoom]) {
        return skip_pge()
    }

    return kill_pge()
}

const pge_op_loadPiegeCounter = (args: ObjectOpcodeArgs, game: Game) => {
	args.pge.counter_value = args.pge.init_PGE.counter_values[args.a]
	return 1
}

const pge_o_unk0x45 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_ZOrder(args.pge, args.a, pge_ZOrderByNumber, 0, game)
}

const pge_o_unk0x46 = (args: ObjectOpcodeArgs, game: Game) => {
	game._pge_compareVar1 = 0
	pge_ZOrder(args.pge, args.a, pge_ZOrderIfDifferentDirection, 0, game)
	return game._pge_compareVar1
}

const pge_o_unk0x47 = (args: ObjectOpcodeArgs, game: Game) => {
	game._pge_compareVar2 = 0
	pge_ZOrder(args.pge, args.a, pge_ZOrderIfSameDirection, 0, game)
	return game._pge_compareVar2
}

const pge_o_unk0x48 = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = game.col_findPiege(game._pgeLive[0], args.pge.init_PGE.counter_values[0])
	if (pge && pge.life === args.pge.life) {
		game.pge_updateGroup(args.pge.index, pge.index, args.a)
		return 1
	}
	return 0
}

const pge_o_unk0x49 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_ZOrder(game._pgeLive[0], args.a, pge_ZOrderIfIndex, args.pge.init_PGE.counter_values[0], game)
}

const pge_o_unk0x4A = (args: ObjectOpcodeArgs, game: Game) => {
	const pge: LivePGE = args.pge
	pge.room_location = 0xFE
	pge.flags &= ~4
	game._pge_liveTable2[pge.index] = null
	const inv_pge:LivePGE = game.pge_getInventoryItemBefore(game._pgeLive[args.a], pge)
	if (inv_pge === game._pgeLive[args.a]) {
		if (pge.index !== inv_pge.current_inventory_PGE) {
			return 1
		}
	} else {
		if (pge.index !== inv_pge.next_inventory_PGE) {
			return 1
		}
	}
	game.pge_removeFromInventory(inv_pge, pge, game._pgeLive[args.a])
	return 1
}

const pge_o_unk0x7F = (args: ObjectOpcodeArgs, game: Game) => {
	const _si: LivePGE = args.pge
	let var4 = _si.collision_slot
	let var2 = _si.index

	while (var4 !== 0xFF) {
		let slot: CollisionSlot = game._col_slotsTable[var4]
		while (slot) {
			if (slot.live_pge !== args.pge) {
				if (slot.live_pge.init_PGE.object_type === 3 && var2 !== slot.live_pge.unkF) {
					return 0
				}
			}
			if (slot.live_pge === args.pge) {
				var4 = slot.index & 0x00FF
			}
			slot = slot.prev_slot
		}
	}

	return 0xFFFF;
}

const pge_o_unk0x6A = (args: ObjectOpcodeArgs, game: Game) => {
	let _si: LivePGE = args.pge
	let pge_room = _si.room_location
	if (pge_room < 0 || pge_room >= 0x40) {
		return 0
	}
	let _bl
	let col_area = 0
	let ct_data:Int8Array = null
	let ctIndex = 0
	if (game._currentRoom === pge_room) {
		col_area = 1
	} else if (game._col_currentLeftRoom === pge_room) {
		col_area = 0
	} else if (game._col_currentRightRoom === pge_room) {
		col_area = 2
	} else {
		return 0
	}
	let grid_pos_x = (_si.pos_x + 8) >> 4
	let grid_pos_y = (_si.pos_y / 72) >> 0
	if (grid_pos_y >= 0 && grid_pos_y <= 2) {
		grid_pos_y *= 16
		let _cx = args.a
		if (game._pge_currentPiegeFacingDir) {
			_cx = -_cx
		}
		if (_cx >= 0) {
			if (_cx > 0x10) {
				_cx = 0x10
			}

			ct_data = game._res._ctData
			ctIndex = 0x100 + pge_room * 0x70 + grid_pos_y * 2 + 0x10 + grid_pos_x
			const var4 = new Uint8Array(game._col_activeCollisionSlots.buffer)
			let var4Index = game._col_activeCollisionSlots.byteOffset + col_area * 0x30 + grid_pos_y + grid_pos_x
			++var4Index
			++ctIndex
			let varA = grid_pos_x
			do {
				--varA
				if (varA < 0) {
					--col_area
					if (col_area < 0) {
						return 0
					}
					pge_room = game._res._ctData[CT_LEFT_ROOM + pge_room]
					if (pge_room < 0) {
						return 0
					}
					varA = 0xF
					ctIndex = 0x101 + pge_room * 0x70 + grid_pos_y * 2 + 0x10 + varA
					var4Index -= 0x1F
				}
				--var4Index
				_bl = var4[var4Index] << 24 >> 24
				if (_bl >= 0) {
					let collision_slot:CollisionSlot = game._col_slotsTable[_bl]
					do {
						_si = collision_slot.live_pge
						if (args.pge !== _si && (_si.flags & 4) && _si.life >= 0) {
							if (_si.init_PGE.object_type === 1 || _si.init_PGE.object_type === 10) {
								return 1
							}
						}
						collision_slot = collision_slot.prev_slot
					} while (collision_slot)
				}
				--ctIndex
				if (ct_data[ctIndex] !== 0) {
					return 0
				}
				--_cx
			} while (_cx >= 0)
		} else {
			_cx = -_cx
			if (_cx > 0x10) {
				_cx = 0x10
			}

			ct_data = game._res._ctData
			ctIndex = 0x101 + pge_room * 0x70 + grid_pos_y * 2 + 0x10 + grid_pos_x
			const var4 = game._col_activeCollisionSlots
			let var4Index = 1 + col_area * 0x30 + grid_pos_y + grid_pos_x
			let varA = grid_pos_x
			let firstRun = true
			do {
				if (!firstRun) {
					++varA
					if (varA === 0x10) {
						++col_area
						if (col_area > 2) {
							return 0
						}
						pge_room = game._res._ctData[CT_RIGHT_ROOM + pge_room]
						if (pge_room < 0) {
							return 0
						}
						varA = 0
						ctIndex = 0x100 + pge_room * 0x70 + grid_pos_y * 2 + 0x10 + varA
						var4Index += 0x20
					}
				}
				firstRun = false

				_bl = var4[var4Index] << 24 >> 24
				++var4Index
				if (_bl >= 0) {
					let collision_slot:CollisionSlot = game._col_slotsTable[_bl]
					do {
						_si = collision_slot.live_pge
						if (args.pge !== _si && (_si.flags & 4) && _si.life >= 0) {
							if (_si.init_PGE.object_type === 1 || _si.init_PGE.object_type === 10) {
								return 1
							}
						}
						collision_slot = collision_slot.prev_slot
					} while (collision_slot)
				}
				_bl = ct_data[ctIndex] << 24 >> 24
				++ctIndex
				if (_bl !== 0) {
					return 0
				}
				--_cx
			} while (_cx >= 0)
		}
	}

	return 0
}

const pge_op_isInGroupSlice = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	let le:GroupPGE = game._pge_groupsTable[pge.index]
	if (le) {
		if (args.a === 0) {
			do {
				if (le.group_id === 1 || le.group_id === 2) {
					return 1
				}
				le = le.next_entry
			} while (le)
		} else {
			do {
				if (le.group_id === 3 || le.group_id === 4) {
					return 1
				}
				le = le.next_entry
			} while (le)
		}
	}

	return 0
}

const pge_o_unk0x5F = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge

	let pge_room = pge.room_location
	if (pge_room < 0 || pge_room >= 0x40) {
        return 0
    }

	let dx
	let _cx = pge.init_PGE.counter_values[0]
	if (_cx <= 0) {
		dx = 1
		_cx = -_cx
	} else {
		dx = -1
	}
	if (game._pge_currentPiegeFacingDir) {
		dx = -dx
	}
	let grid_pos_x = (pge.pos_x + 8) >> 4
	let grid_pos_y = 0

	do {
		let _ax = game.col_getGridData(pge, 1, -grid_pos_y)
		if (_ax !== 0) {
			if (!(_ax & 2) || args.a !== 1) {
				pge.room_location = pge_room
				pge.pos_x = grid_pos_x * 16

				return 1
			}
		}
		if (grid_pos_x < 0) {
			pge_room = game._res._ctData[CT_LEFT_ROOM + pge_room]
			if (pge_room < 0 || pge_room >= 0x40) {
                return 0
            }
			grid_pos_x += 16
		} else if (grid_pos_x > 15) {
			pge_room = game._res._ctData[CT_RIGHT_ROOM + pge_room]
			if (pge_room < 0 || pge_room >= 0x40) {
                return 0
            }
			grid_pos_x -= 16
		}
		grid_pos_x += dx
		++grid_pos_y
	} while (grid_pos_y <= _cx)

	return 0
}

const pge_op_findAndCopyPiege = (args: ObjectOpcodeArgs, game: Game) => {
	let le:GroupPGE = game._pge_groupsTable[args.pge.index]
	while (le) {
		if (le.group_id === args.a) {
			args.a = le.index
			args.b = 0
			pge_op_copyPiege(args, game)
			return 1
		}
		le = le.next_entry
	}
	return 0
}

const pge_op_isInRandomRange = (args: ObjectOpcodeArgs, game: Game) => {
	let n = args.a & 0xFFFF
	if (n !== 0) {
		if ((game.getRandomNumber() % n) === 0) {
			return 1
		}
	}

	return 0
}

const pge_o_unk0x62 = (args: ObjectOpcodeArgs, game: Game) => {
	return col_detectHit(args.pge, args.a, args.b, col_detectHitCallback3, col_detectHitCallback1, 0, -1, game)
}

const pge_o_unk0x63 = (args: ObjectOpcodeArgs, game: Game) => {
	return col_detectHit(args.pge, args.a, args.b, col_detectHitCallback2, col_detectHitCallback1, 0, -1, game)
}

const pge_o_unk0x64 = (args: ObjectOpcodeArgs, game: Game) => {
	return col_detectGunHit(args.pge, args.a, args.b, col_detectGunHitCallback3, col_detectGunHitCallback1, 1, -1, game)
}

const pge_o_unk0x67 = (args: ObjectOpcodeArgs, game: Game) => {
	if (game.col_getGridData(args.pge, 1, -args.a) & 2) {
		return 0xFFFF
	}

	return 0
}

const pge_op_setCollisionState2 = (args: ObjectOpcodeArgs, game: Game) => {
	return pge_updateCollisionState(args.pge, args.a, 2, game)
}

const pge_op_isCollidingObject = (args: ObjectOpcodeArgs, game: Game) => {
	const { obj } = game.col_findCurrentCollidingObject(args.pge, 3, 0xFF, 0xFF)
	if (obj === args.a) {
		return 1
	} else {
		return 0
	}
}

const pge_o_unk0x6F = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = args.pge
	let le:GroupPGE = game._pge_groupsTable[pge.index]
	while (le) {
		if (args.a === le.group_id) {
			game.pge_updateGroup(pge.index, le.index, 0xC)
			return 1;
		}
		le = le.next_entry
	}

	return 0
}

const pge_o_unk0x73 = (args: ObjectOpcodeArgs, game: Game) => {
	const pge:LivePGE = game.col_findPiege(args.pge, args.a)
	if (pge !== null) {
		game.pge_updateInventory(pge, args.pge)
		return 0xFFFF
	}
	return 0
}

const pge_op_setLifeCounter = (args: ObjectOpcodeArgs, game: Game) => {
	game._pgeLive[args.a].life = args.pge.init_PGE.counter_values[0]
	return 1
}

const pge_op_decLifeCounter = (args: ObjectOpcodeArgs, game: Game) => {
	args.pge.life = game._pgeLive[args.a].life - 1
	return 1
}

const pge_op_playCutscene = (args: ObjectOpcodeArgs, game: Game) => {
	if (game._deathCutsceneCounter === 0) {
		game._cut._id = args.a
	}

	return 1
}

const pge_o_unk0x86 = (args:ObjectOpcodeArgs, game: Game) => {
	return col_detectGunHit(args.pge, args.a, args.b, col_detectGunHitCallback2, col_detectGunHitCallback1, 1, 0, game)
}

const pge_op_playSoundGroup = (args: ObjectOpcodeArgs, game: Game) => {
    if (args.a >= 4) {
        throw(`Assertion failed: ${args.a} < 4`)
    }
	const c = args.pge.init_PGE.counter_values[args.a] & 0xFFFF
	const sfxId = c & 0xFF
	const softVol = c >> 8
	game.playSound(sfxId, softVol)
	return 0xFFFF
}

const pge_op_adjustPos = (args: ObjectOpcodeArgs, game: Game) => {
	const pge: LivePGE = args.pge
	pge.pos_x &= 0xFFF0
	if (pge.pos_y !== 70 && pge.pos_y != 142 && pge.pos_y !== 214) {
		pge.pos_y = (((pge.pos_y / 72) >> 0) + 1) * 72 - 2
	}

	return 0xFFFF
}

const pge_op_setTempVar1 = (args: ObjectOpcodeArgs, game: Game) => {
	game._pge_opTempVar1 = args.a

	return 0xFFFF
}

const pge_op_isTempVar1Set = (args: ObjectOpcodeArgs, game: Game) => {
	if (game._pge_opTempVar1 !== args.a) {
		return 0
	} else {
		return 0xFFFF
	}
}

const _pge_opcodeTable = [
    null,
    pge_op_isInpUp, // this.pge_op_isInpUp.bind(this),
    pge_op_isInpBackward, // this.pge_op_isInpBackward.bind(this),
    pge_op_isInpDown, // this.pge_op_isInpDown.bind(this),
    // /* 0x04 */
    pge_op_isInpForward, // this.pge_op_isInpForward.bind(this),
    pge_op_isInpUpMod, // this.pge_op_isInpUpMod.bind(this),
    pge_op_isInpBackwardMod, // this.pge_op_isInpBackwardMod.bind(this),
    pge_op_isInpDownMod, // this.pge_op_isInpDownMod.bind(this),
    // /* 0x08 */
    pge_op_isInpForwardMod, // this.pge_op_isInpForwardMod.bind(this),
    pge_op_isInpIdle, // this.pge_op_isInpIdle.bind(this),
    pge_op_isInpNoMod, // this.pge_op_isInpNoMod.bind(this),
    pge_op_getCollision0u, // this.pge_op_getCollision0u.bind(this),
    // /* 0x0C */
    pge_op_getCollision00, // this.pge_op_getCollision00.bind(this),
    pge_op_getCollision0d, // this.pge_op_getCollision0d.bind(this),
    pge_op_getCollision1u, // this.pge_op_getCollision1u.bind(this),
    pge_op_getCollision10, // this.pge_op_getCollision10.bind(this),
    // /* 0x10 */
    pge_op_getCollision1d, // this.pge_op_getCollision1d.bind(this),
    pge_op_getCollision2u, // this.pge_op_getCollision2u.bind(this),
    pge_op_getCollision20, // this.pge_op_getCollision20.bind(this),
    pge_op_getCollision2d, // this.pge_op_getCollision2d.bind(this),
    // /* 0x14 */
    pge_op_doesNotCollide0u, // this.pge_op_doesNotCollide0u.bind(this),
    pge_op_doesNotCollide00, // this.pge_op_doesNotCollide00.bind(this),
    pge_op_doesNotCollide0d, // this.pge_op_doesNotCollide0d.bind(this),
    pge_op_doesNotCollide1u, // this.pge_op_doesNotCollide1u.bind(this),
    // /* 0x18 */
    pge_op_doesNotCollide10, // this.pge_op_doesNotCollide10.bind(this),
    null, // this.pge_op_doesNotCollide1d.bind(this),
    pge_op_doesNotCollide2u, // this.pge_op_doesNotCollide2u.bind(this),
    pge_op_doesNotCollide20, // this.pge_op_doesNotCollide20.bind(this),
    // /* 0x1C */
    pge_op_doesNotCollide2d, // this.pge_op_doesNotCollide2d.bind(this),
    pge_op_collides0o0d, // this.pge_op_collides0o0d.bind(this),
    pge_op_collides2o2d, // this.pge_op_collides2o2d.bind(this),
    pge_op_collides0o0u, // this.pge_op_collides0o0u.bind(this),
    // /* 0x20 */
    pge_op_collides2o2u, // this.pge_op_collides2o2u.bind(this),
    pge_op_collides2u2o, // this.pge_op_collides2u2o.bind(this),
    pge_op_isInGroup, // this.pge_op_isInGroup.bind(this),
    pge_op_updateGroup0, // this.pge_op_updateGroup0.bind(this),
    // /* 0x24 */
    pge_op_updateGroup1, // this.pge_op_updateGroup1.bind(this),
    pge_op_updateGroup2, // this.pge_op_updateGroup2.bind(this),
    pge_op_updateGroup3, // this.pge_op_updateGroup3.bind(this),
    pge_op_isPiegeDead, // this.pge_op_isPiegeDead.bind(this),
    // /* 0x28 */
    pge_op_collides1u2o, // this.pge_op_collides1u2o.bind(this),
    pge_op_collides1u1o, // this.pge_op_collides1u1o.bind(this),
    pge_op_collides1o1u, // this.pge_op_collides1o1u.bind(this),
    pge_o_unk0x2B, // this.pge_o_unk0x2B.bind(this),
    // /* 0x2C */
    pge_o_unk0x2C, // this.pge_o_unk0x2C.bind(this),
    pge_o_unk0x2D, // this.pge_o_unk0x2D.bind(this),
    pge_op_nop, // this.pge_op_nop.bind(this),
    pge_op_pickupObject, // this.pge_op_pickupObject.bind(this),
    // /* 0x30 */
    pge_op_addItemToInventory, // this.pge_op_addItemToInventory.bind(this),
    pge_op_copyPiege, // this.pge_op_copyPiege.bind(this),
    pge_op_canUseCurrentInventoryItem, // this.pge_op_canUseCurrentInventoryItem.bind(this),
    pge_op_removeItemFromInventory, // this.pge_op_removeItemFromInventory.bind(this),
    // /* 0x34 */
    pge_o_unk0x34, // this.pge_o_unk0x34.bind(this),
    pge_op_isInpMod, // this.pge_op_isInpMod.bind(this),
    pge_op_setCollisionState1, // this.pge_op_setCollisionState1.bind(this),
    pge_op_setCollisionState0, // this.pge_op_setCollisionState0.bind(this),
    // /* 0x38 */
    pge_op_isInGroup1, // this.pge_op_isInGroup1.bind(this),
    pge_op_isInGroup2, // this.pge_op_isInGroup2.bind(this),
    pge_op_isInGroup3, // this.pge_op_isInGroup3.bind(this),
    pge_op_isInGroup4, // this.pge_op_isInGroup4.bind(this),
    // /* 0x3C */
    pge_o_unk0x3C, // this.pge_o_unk0x3C.bind(this),
    pge_o_unk0x3D, // this.pge_o_unk0x3D.bind(this),
    pge_op_setPiegeCounter, // this.pge_op_setPiegeCounter.bind(this),
    pge_op_decPiegeCounter, // this.pge_op_decPiegeCounter.bind(this),
    // /* 0x40 */
    pge_o_unk0x40, // this.pge_o_unk0x40.bind(this),
    pge_op_wakeUpPiege, // this.pge_op_wakeUpPiege.bind(this),
    pge_op_removePiege, // this.pge_op_removePiege.bind(this),
    pge_op_removePiegeIfNotNear, // this.pge_op_removePiegeIfNotNear.bind(this),
    // /* 0x44 */
    pge_op_loadPiegeCounter, // this.pge_op_loadPiegeCounter.bind(this),
    pge_o_unk0x45, // this.pge_o_unk0x45.bind(this),
    pge_o_unk0x46, // this.pge_o_unk0x46.bind(this),
    pge_o_unk0x47, // this.pge_o_unk0x47.bind(this),
    // /* 0x48 */
    pge_o_unk0x48, // this.pge_o_unk0x48.bind(this),
    pge_o_unk0x49, // this.pge_o_unk0x49.bind(this),
    pge_o_unk0x4A, // this.pge_o_unk0x4A.bind(this),
    pge_op_killPiege, // this.pge_op_killPiege.bind(this),
    // /* 0x4C */
    pge_op_isInCurrentRoom, // this.pge_op_isInCurrentRoom.bind(this),
    pge_op_isNotInCurrentRoom, // this.pge_op_isNotInCurrentRoom.bind(this),
    pge_op_scrollPosY, // this.pge_op_scrollPosY.bind(this),
    pge_op_playDefaultDeathCutscene, // this.pge_op_playDefaultDeathCutscene.bind(this),
    // /* 0x50 */
    pge_o_unk0x50, // this.pge_o_unk0x50.bind(this),
    null,
    pge_o_unk0x52, // this.pge_o_unk0x52.bind(this),
    pge_o_unk0x53, // this.pge_o_unk0x53.bind(this),
    // /* 0x54 */
    pge_op_isPiegeNear, // this.pge_op_isPiegeNear.bind(this),
    pge_op_setLife, // this.pge_op_setLife.bind(this),
    pge_op_incLife, // this.pge_op_incLife.bind(this),
    pge_op_setPiegeDefaultAnim, // this.pge_op_setPiegeDefaultAnim.bind(this),
    // /* 0x58 */
    pge_op_setLifeCounter, // this.pge_op_setLifeCounter.bind(this),
    pge_op_decLifeCounter, // this.pge_op_decLifeCounter.bind(this),
    pge_op_playCutscene, // this.pge_op_playCutscene.bind(this),
    null, // this.pge_op_isTempVar2Set.bind(this),
    // /* 0x5C */
    null, // this.pge_op_playDeathCutscene.bind(this),
    null, // this.pge_o_unk0x5D.bind(this),
    null, // this.pge_o_unk0x5E.bind(this),
    pge_o_unk0x5F, // this.pge_o_unk0x5F.bind(this),
    // /* 0x60 */
    pge_op_findAndCopyPiege, // this.pge_op_findAndCopyPiege.bind(this),
    pge_op_isInRandomRange, // this.pge_op_isInRandomRange.bind(this),
    pge_o_unk0x62, // this.pge_o_unk0x62.bind(this),
    pge_o_unk0x63, // this.pge_o_unk0x63.bind(this),
    // /* 0x64 */
    pge_o_unk0x64, // this.pge_o_unk0x64.bind(this),
    null, // this.pge_op_addToCredits.bind(this),
    null, // this.pge_op_subFromCredits.bind(this),
    pge_o_unk0x67, // this.pge_o_unk0x67.bind(this),
    // /* 0x68 */
    pge_op_setCollisionState2, // this.pge_op_setCollisionState2.bind(this),
    null, // this.pge_op_saveState.bind(this),
    pge_o_unk0x6A, // this.pge_o_unk0x6A.bind(this),
    pge_op_isInGroupSlice, // this.pge_op_isInGroupSlice.bind(this),
    // /* 0x6C */
    null, // this.pge_o_unk0x6C.bind(this),
    pge_op_isCollidingObject, // this.pge_op_isCollidingObject.bind(this),
    null, // this.pge_o_unk0x6E.bind(this),
    pge_o_unk0x6F, // this.pge_o_unk0x6F.bind(this),
    // /* 0x70 */
    null, // this.pge_o_unk0x70.bind(this),
    null, // this.pge_o_unk0x71.bind(this),
    null, // this.pge_o_unk0x72.bind(this),
    pge_o_unk0x73, // this.pge_o_unk0x73.bind(this),
    // /* 0x74 */
    null, // this.pge_op_collides4u.bind(this),
    null, // this.pge_op_doesNotCollide4u.bind(this),
    null, // this.pge_op_isBelowConrad.bind(this),
    null, // this.pge_op_isAboveConrad.bind(this),
    // /* 0x78 */
    pge_op_isNotFacingConrad, // this.pge_op_isNotFacingConrad.bind(this),
    pge_op_isFacingConrad, // this.pge_op_isFacingConrad.bind(this),
    null, // this.pge_op_collides2u1u.bind(this),
    null, // this.pge_op_displayText.bind(this),
    // /* 0x7C */
    pge_o_unk0x7C, // this.pge_o_unk0x7C.bind(this),
    pge_op_playSound, // this.pge_op_playSound.bind(this),
    pge_o_unk0x7E, // this.pge_o_unk0x7E.bind(this),
    pge_o_unk0x7F, // this.pge_o_unk0x7F.bind(this),
    // /* 0x80 */
    null, // this.pge_op_setPiegePosX.bind(this),
    null, // this.pge_op_setPiegePosModX.bind(this),
    null, // this.pge_op_changeRoom.bind(this),
    pge_op_hasInventoryItem, // this.pge_op_hasInventoryItem.bind(this),
    // /* 0x84 */
    null, // this.pge_op_changeLevel.bind(this),
    null, // this.pge_op_shakeScreen.bind(this),
    pge_o_unk0x86, // this.pge_o_unk0x86.bind(this),
    pge_op_playSoundGroup, // this.pge_op_playSoundGroup.bind(this),
    // /* 0x88 */
    pge_op_adjustPos, // this.pge_op_adjustPos.bind(this),
    null,
    pge_op_setTempVar1, // this.pge_op_setTempVar1.bind(this),
    pge_op_isTempVar1Set, // this.pge_op_isTempVar1Set.bind(this)
]

export { _pge_opcodeTable }
