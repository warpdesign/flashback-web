import { CT_LEFT_ROOM, CT_RIGHT_ROOM, Game } from './game'
import { CollisionSlot, InitPGE, LivePGE, Obj, ObjectNode } from './intern'
import type { col_Callback1, col_Callback2 } from './game'


const col_detectHit = (pge: LivePGE, arg2: number, arg4: number, callback1: col_Callback1, callback2: col_Callback2, argA: number, argC: number, game: Game) => {
	let pos_dx, pos_dy, var8, varA
	let collision_score = 0
	let pge_room = pge.room_location << 24 >> 24

	if (pge_room < 0 || pge_room >= 0x40) {
		return 0
	}
	let thr = pge.init_PGE.counter_values[0]

	if (thr > 0) {
		pos_dx = -1
		pos_dy = -1
	} else {
		pos_dx = 1
		pos_dy = 1
		thr = -thr
	}
	if (game._pge_currentPiegeFacingDir) {
		pos_dx = -pos_dx
	}
	let grid_pos_x = (pge.pos_x + 8) >> 4
	let grid_pos_y = ((pge.pos_y / 72)) >> 0
	if (grid_pos_y >= 0 && grid_pos_y <= 2) {
		grid_pos_y *= 16
		collision_score = 0
		var8 = 0
		varA = 0
		if (argA !== 0) {
			var8 = pos_dy
			grid_pos_x += pos_dx
			varA = 1
		}
		while (varA <= thr) {
			if (grid_pos_x < 0) {
				pge_room = game._res._ctData[CT_LEFT_ROOM + pge_room]
				if (pge_room < 0) break
				grid_pos_x += 16
			}
			if (grid_pos_x >= 16) {
				pge_room = game._res._ctData[CT_RIGHT_ROOM + pge_room]
				if (pge_room < 0) break
				grid_pos_x -= 16
			}
			let slot = game.col_findSlot(grid_pos_y + grid_pos_x + pge_room * 64)
			if (slot >= 0) {
				let cs: CollisionSlot = game._col_slotsTable[slot]
				while (cs) {
					collision_score += callback1(cs.live_pge, pge, arg2, arg4, game)
					cs = cs.prev_slot
				}
			}
			if (callback2(pge, var8, varA, arg2, game) !== 0) {
				break
			}
			grid_pos_x += pos_dx
			++varA
			var8 += pos_dy
		}
	}
	if (argC === -1) {
		return collision_score
	} else {
		return 0
	}
}

const col_detectHitCallbackHelper = (pge:LivePGE, groupId: number, game: Game) => {
	const init_pge:InitPGE = pge.init_PGE
    if (init_pge.obj_node_number >= game._res._numObjectNodes) {
        throw(`Assertion error: ${init_pge.obj_node_number} < ${game._res._numObjectNodes}`)
    }
	// assert(init_pge->obj_node_number < _res._numObjectNodes);
	const on:ObjectNode = game._res._objectNodesMap[init_pge.obj_node_number]
	let obj:Obj = on.objects[pge.first_obj_number]
	let i = pge.first_obj_number
	while (pge.obj_type === obj.type && on.last_obj_number > i) {
		if (obj.opcode2 === 0x6B) { // pge_op_isInGroupSlice
			if (obj.opcode_arg2 === 0) {
				if (groupId === 1 || groupId === 2) {
                    return 0xFFFF
                }
			}
			if (obj.opcode_arg2 === 1) {
				if (groupId === 3 || groupId === 4) {
                    return 0xFFFF
                }
			}
		} else if (obj.opcode2 === 0x22) { // pge_op_isInGroup
			if (obj.opcode_arg2 === groupId) {
                return 0xFFFF
            }
		}

		if (obj.opcode1 === 0x6B) { // pge_op_isInGroupSlice
			if (obj.opcode_arg1 === 0) {
				if (groupId === 1 || groupId === 2) {
                    return 0xFFFF
                }
			}
			if (obj.opcode_arg1 === 1) {
				if (groupId === 3 || groupId === 4) {
                    return 0xFFFF
                }
			}
		} else if (obj.opcode1 === 0x22) { // pge_op_isInGroup
			if (obj.opcode_arg1 === groupId) {
                return 0xFFFF
            }
		}
		// ++obj;
		++i;
        obj = on.objects[i]
	}

	return 0
}

const col_detectHitCallback3 = (pge1: LivePGE, pge2: LivePGE, unk1: number, unk2: number, game: Game) => {
	if (pge1 !== pge2 && (pge1.flags & 4)) {
		if (pge1.init_PGE.object_type === unk2) {
			if ((pge1.flags & 1) != (pge2.flags & 1)) {
				if (col_detectHitCallbackHelper(pge1, unk1, game) === 0) {
					return 1
				}
			}
		}
	}

	return 0
}

const col_detectHitCallback2 = (pge1: LivePGE, pge2: LivePGE, unk1: number, unk2: number, game: Game) => {
	if (pge1 !== pge2 && (pge1.flags & 4)) {
		if (pge1.init_PGE.object_type === unk2) {
			if ((pge1.flags & 1) === (pge2.flags & 1)) {
				if (col_detectHitCallbackHelper(pge1, unk1, game) === 0) {
					return 1
				}
			}
		}
	}

	return 0
}

const col_detectHitCallback1 = (pge: LivePGE, dy: number, unk1: number, unk2: number, game: Game) => {
	if (game.col_getGridData(pge, 1, dy) !== 0) {
		return 1
	} else {
		return 0
	}
}

const col_detectHitCallback4 = (pge1: LivePGE, pge2: LivePGE, unk1: number, unk2: number, game: Game) => {
	if (pge1 !== pge2 && (pge1.flags & 4)) {
		if (pge1.init_PGE.object_type === unk2) {
			if ((pge1.flags & 1) !== (pge2.flags & 1)) {
				if (col_detectHitCallbackHelper(pge1, unk1, game) === 0) {
					game.pge_updateGroup(pge2.index, pge1.index, unk1)
					return 1
				}
			}
		}
	}
	return 0
}

const col_detectHitCallback5 = (pge1: LivePGE, pge2: LivePGE, unk1: number, unk2: number, game: Game) => {
	if (pge1 !== pge2 && (pge1.flags & 4)) {
		if (pge1.init_PGE.object_type === unk2) {
			if ((pge1.flags & 1) === (pge2.flags & 1)) {
				if (col_detectHitCallbackHelper(pge1, unk1, game) === 0) {
					game.pge_updateGroup(pge2.index, pge1.index, unk1)
					return 1
				}
			}
		}
	}
	return 0
}

const col_detectGunHitCallback1 = (pge: LivePGE, arg2: number, arg4: number, arg6: number, game: Game) => {
	const _ax = game.col_getGridData(pge, 1, arg2)
	if (_ax !== 0) {
		if (!(_ax & 2) || (arg6 !== 1)) {
			return _ax
		}
	}

	return 0
}

const col_detectGunHitCallback2 = (pge1: LivePGE, pge2: LivePGE, arg4: number, arg5: number, game: Game) => {
	if (pge1 !== pge2 && (pge1.flags & 4)) {
		if (pge1.init_PGE.object_type === 1 || pge1.init_PGE.object_type === 10) {
			let id
			if ((pge1.flags & 1) !== (pge2.flags & 1)) {
				id = 4
				if (arg4 === 0) {
					id = 3
				}
			} else {
				id = 2
				if (arg4 === 0) {
					id = 1
				}
			}
			if (col_detectHitCallbackHelper(pge1, id, game) !== 0) {
				game.pge_updateGroup(pge2.index, pge1.index, id)
				return 1
			}
		}
	}
	return 0;
}

const col_detectGunHitCallback3 = (pge1: LivePGE, pge2: LivePGE, arg4: number, arg5: number, game: Game) => {
	if (pge1 !== pge2 && (pge1.flags & 4)) {
		if (pge1.init_PGE.object_type === 1 || pge1.init_PGE.object_type === 12 || pge1.init_PGE.object_type === 10) {
			let id
			if ((pge1.flags & 1) !== (pge2.flags & 1)) {
				id = 4;
				if (arg4 === 0) {
					id = 3;
				}
			} else {
				id = 2;
				if (arg4 === 0) {
					id = 1;
				}
			}
			if (col_detectHitCallbackHelper(pge1, id, game) !== 0) {
				game.pge_updateGroup(pge2.index, pge1.index, id)
				return 1
			}
		}
	}

	return 0
}

const col_detectGunHit = (pge: LivePGE, arg2: number, arg4: number, callback1: col_Callback1, callback2: col_Callback2, argA: number, argC: number, game: Game) => {
	let pge_room = pge.room_location
	if (pge_room < 0 || pge_room >= 0x40) return 0
	let thr, pos_dx, pos_dy
	if (argC === -1) {
		thr = pge.init_PGE.counter_values[0]
	} else {
		thr = pge.init_PGE.counter_values[3]
	}
	if (thr > 0) {
		pos_dx = -1
		pos_dy = -1
	} else {
		pos_dx = 1
		pos_dy = 1
		thr = -thr
	}
	if (game._pge_currentPiegeFacingDir) {
		pos_dx = -pos_dx
	}

	let grid_pos_x = (pge.pos_x + 8) >> 4
	let grid_pos_y = ((pge.pos_y - 8) / 72) >> 0

	if (grid_pos_y >= 0 && grid_pos_y <= 2) {
		grid_pos_y *= 16
		let var8 = 0
		let varA = 0
		if (argA !== 0) {
			var8 = pos_dy
			grid_pos_x += pos_dx
			varA = 1
		}
		while (varA <= thr) {
			if (grid_pos_x < 0) {
				pge_room = game._res._ctData[CT_LEFT_ROOM + pge_room]
				if (pge_room < 0) {
                    return 0
                }
				grid_pos_x += 0x10;
			}
			if (grid_pos_x >= 0x10) {
				pge_room = game._res._ctData[CT_RIGHT_ROOM + pge_room];
				if (pge_room < 0) {
                    return 0
                }
				grid_pos_x -= 0x10
			}
			let slot = game.col_findSlot(pge_room * 64 + grid_pos_x + grid_pos_y)
			if (slot >= 0) {
				let cs:CollisionSlot = game._col_slotsTable[slot]
				while (cs) {
					const r = callback1(cs.live_pge, pge, arg2, arg4, game)
					if (r !== 0) {
                        return r
                    }
					cs = cs.prev_slot
				}
			}
			if (callback2(pge, var8, varA, arg2, game) !== 0) {
				break
			}
			grid_pos_x += pos_dx
			++varA
			var8 += pos_dy
		}
	}

	return 0
}

export { col_detectHitCallbackHelper, col_detectHitCallback1, col_detectHitCallback2, col_detectHitCallback3, col_detectHitCallback4, col_detectHitCallback5, col_detectHit, col_detectGunHitCallback1, col_detectGunHitCallback2, col_detectGunHitCallback3, col_detectGunHit }
