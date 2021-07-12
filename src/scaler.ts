// typedef void (*ScaleProc32)(int factor, uint32_t *dst, int dstPitch, const uint32_t *src, int srcPitch, int w, int h);
type ScaleProc32 = (factor: number, dst: ArrayBuffer, dstPitch: number, src: ArrayBuffer, srcPitch: number, w: number, h: number) => void

enum ScalerType {
	kScalerTypePoint,
	kScalerTypeLinear,
	kScalerTypeInternal,
	kScalerTypeExternal,
};

const SCALER_TAG = 1

interface Scaler {
	tag: number
	name: string
	factorMin: number
    factorMax: number
	scale: ScaleProc32 
}

const scanline2x = (dst0: Uint32Array, dst1: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, w: number) => {
	let B, D, E, F, H

	// ABC
	// DEF
	// GHI

	let x = 0;
	let dst0_i = 0
	let dst1_i = 0

	// first pixel (D == E)
	B = src0[x] // *(src0 + x);
	E = src1[x] // *(src1 + x);
	D = E
	F = src1[x + 1] // *(src1 + x + 1);
	H = src2[x] // *(src2 + x);
	if (B != H && D != F) {
		dst0[0] = D == B ? D : E;
		dst0[1] = B == F ? F : E;
		dst1[0] = D == H ? D : E;
		dst1[1] = H == F ? F : E;
	} else {
		dst0[0] = E;
		dst0[1] = E;
		dst1[0] = E;
		dst1[1] = E;
	}
	dst0_i += 2;
	dst1_i += 2;

	// center pixels
	E = F;
	for (x = 1; x < w - 1; ++x) {
		B = src0[x] // *(src0 + x);
		F = src1[x + 1] // *(src1 + x + 1);
		H = src2[x] //*(src2 + x);
		if (B != H && D != F) {
			dst0[0 + dst0_i] = D == B ? D : E;
			dst0[1+ dst0_i] = B == F ? F : E;
			dst1[0 + dst1_i] = D == H ? D : E;
			dst1[1 + dst1_i] = H == F ? F : E;
		} else {
			dst0[0 + dst0_i] = E;
			dst0[1 + dst0_i] = E;
			dst1[0 + dst1_i] = E;
			dst1[1 + dst1_i] = E;
		}
		D = E; E = F;
		dst0_i += 2;
		dst1_i += 2;
	}

	// last pixel (F == E)
	B = src0[0] // *(src0 + x);
	H = src2[x] // *(src2 + x);
	if (B != H && D != F) {
		dst0[0 + dst0_i] = D == B ? D : E;
		dst0[1 + dst1_i] = B == F ? F : E;
		dst1[0 + dst0_i] = D == H ? D : E;
		dst1[1 + dst1_i] = H == F ? F : E;
	} else {
		dst0[0 + dst0_i] = E;
		dst0[1 + dst1_i] = E;
		dst1[0 + dst0_i] = E;
		dst1[1 + dst1_i] = E;
	}
}

const scale2x = (dst: Uint32Array, dstPitch: number, src: Uint32Array, srcPitch: number, w: number, h: number) => {
	if (w <= 1 || h <= 1) {
		throw 'scale2x: w <= 1 || h <= 1 !!'
	}

	const dstPitch2 = dstPitch * 2;

	// y == 0
	let src0 = src;
	let src1 = src;
	let src2 = new Uint32Array(src.buffer, srcPitch)
	scanline2x(dst, new Uint32Array(dst.buffer, dstPitch), src0, src1, src2, w);
	let dst2 = new Uint32Array(dst.buffer, dstPitch2)

	// center
	src0 = src;
	src1 = new Uint32Array(src.buffer, srcPitch)
	src2 = new Uint32Array(src, srcPitch * 2)
	for (let y = 1; y < h - 1; ++y) {
		scanline2x(dst2, new Uint32Array(dst2.buffer, dstPitch), src0, src1, src2, w)
		dst2 = new Uint32Array(dst2.buffer, dstPitch2)

		src0 = new Uint32Array(src0.buffer, srcPitch)
		src1 = new Uint32Array(src1.buffer, srcPitch)
		src2 = new Uint32Array(src2.buffer, srcPitch)
	}

	// y == h-1
	src2 = src1
	scanline2x(dst2, new Uint32Array(dst2.buffer, dstPitch), src0, src1, src2, w)
}

const scanline3x = (dst0: Uint32Array, dst1: Uint32Array, dst2: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, w: number) => {
	// TODO
	throw 'scanline3x not implemented! Use scanline2x instead!'
	// uint32_t A, B, C, D, E, F, G, H, I;

	// // ABC
	// // DEF
	// // GHI

	// int x = 0;

	// // first pixel (A == B, D == E and G == H)
	// B = *(src0 + x);
	// A = B;
	// C = *(src0 + x + 1);
	// E = *(src1 + x);
	// D = E;
	// F = *(src1 + x + 1);
	// H = *(src2 + x);
	// G = H;
	// I = *(src2 + x + 1);
	// if (B != H && D != F) {
	// 	dst0[0] = D == B ? D : E;
	// 	dst0[1] = (E == B && E != C) || (B == F && E != A) ? B : E;
	// 	dst0[2] = B == F ? F : E;
	// 	dst1[0] = (D == B && E != G) || (D == B && E != A) ? D : E;
	// 	dst1[1] = E;
	// 	dst1[2] = (B == F && E != I) || (H == F && E != C) ? F : E;
	// 	dst2[0] = D == H ? D : E;
	// 	dst2[1] = (D == H && E != I) || (H == F && E != G) ? H : E;
	// 	dst2[2] = H == F ? F : E;
	// } else {
	// 	dst0[0] = E;
	// 	dst0[1] = E;
	// 	dst0[2] = E;
	// 	dst1[0] = E;
	// 	dst1[1] = E;
	// 	dst1[2] = E;
	// 	dst2[0] = E;
	// 	dst2[1] = E;
	// 	dst2[2] = E;
	// }
	// dst0 += 3;
	// dst1 += 3;
	// dst2 += 3;

	// // center pixels
	// B = C;
	// E = F;
	// H = I;
	// for (x = 1; x < w - 1; ++x) {
	// 	C = *(src0 + x + 1);
	// 	F = *(src1 + x + 1);
	// 	I = *(src2 + x + 1);
	// 	if (B != H && D != F) {
	// 		dst0[0] = D == B ? D : E;
	// 		dst0[1] = (E == B && E != C) || (B == F && E != A) ? B : E;
	// 		dst0[2] = B == F ? F : E;
	// 		dst1[0] = (D == B && E != G) || (D == B && E != A) ? D : E;
	// 		dst1[1] = E;
	// 		dst1[2] = (B == F && E != I) || (H == F && E != C) ? F : E;
	// 		dst2[0] = D == H ? D : E;
	// 		dst2[1] = (D == H && E != I) || (H == F && E != G) ? H : E;
	// 		dst2[2] = H == F ? F : E;
	// 	} else {
	// 		dst0[0] = E;
	// 		dst0[1] = E;
	// 		dst0[2] = E;
	// 		dst1[0] = E;
	// 		dst1[1] = E;
	// 		dst1[2] = E;
	// 		dst2[0] = E;
	// 		dst2[1] = E;
	// 		dst2[2] = E;
	// 	}
	// 	A = B; B = C;
	// 	D = E; E = F;
	// 	G = H; H = I;
	// 	dst0 += 3;
	// 	dst1 += 3;
	// 	dst2 += 3;
	// }

	// // last pixel (B == C, E == F and H == I)
	// if (B != H && D != F) {
	// 	dst0[0] = D == B ? D : E;
	// 	dst0[1] = (E == B && E != C) || (B == F && E != A) ? B : E;
	// 	dst0[2] = B == F ? F : E;
	// 	dst1[0] = (D == B && E != G) || (D == B && E != A) ? D : E;
	// 	dst1[1] = E;
	// 	dst1[2] = (B == F && E != I) || (H == F && E != C) ? F : E;
	// 	dst2[0] = D == H ? D : E;
	// 	dst2[1] = (D == H && E != I) || (H == F && E != G) ? H : E;
	// 	dst2[2] = H == F ? F : E;
	// } else {
	// 	dst0[0] = E;
	// 	dst0[1] = E;
	// 	dst0[2] = E;
	// 	dst1[0] = E;
	// 	dst1[1] = E;
	// 	dst1[2] = E;
	// 	dst2[0] = E;
	// 	dst2[1] = E;
	// 	dst2[2] = E;
	// }
}

const scale3x = (dst: Uint32Array, dstPitch: number, src: Uint32Array, srcPitch: number, w: number, h: number) => {
	// TODO
	throw 'scale3x not implemented! use scale2x instead!'
	// assert(w > 1 && h > 1);
	// const int dstPitch2 = dstPitch * 2;
	// const int dstPitch3 = dstPitch * 3;

	// const uint32_t *src0, *src1, *src2;

	// // y == 0
	// src0 = src;
	// src1 = src;
	// src2 = src + srcPitch;
	// scanline3x(dst, dst + dstPitch, dst + dstPitch2, src0, src1, src2, w);
	// dst += dstPitch3;

	// // center
	// src0 = src;
	// src1 = src + srcPitch;
	// src2 = src + srcPitch * 2;
	// for (int y = 1; y < h - 1; ++y) {
	// 	scanline3x(dst, dst + dstPitch, dst + dstPitch2, src0, src1, src2, w);
	// 	dst += dstPitch3;

	// 	src0 += srcPitch;
	// 	src1 += srcPitch;
	// 	src2 += srcPitch;
	// }

	// // y == h-1
	// src2 = src1;
	// scanline3x(dst, dst + dstPitch, dst + dstPitch2, src0, src1, src2, w);
}

const scale4x = (dst: Uint32Array, dstPitch: number, src: Uint32Array, srcPitch: number, w: number, h: number) => {
	// TODO
	throw 'scale4x not implemented! Use scale2x instead!'
	// static struct {
	// 	uint32_t *ptr;
	// 	int w, h, pitch;
	// 	int size;
	// } buf;
	// const int size = (w * 2) * (h * 2) * sizeof(uint32_t);
	// if (buf.size < size) {
	// 	free(buf.ptr);
	// 	buf.size = size;
	// 	buf.w = w * 2;
	// 	buf.h = h * 2;
	// 	buf.pitch = buf.w;
	// 	buf.ptr = (uint32_t *)malloc(buf.size);
	// 	if (!buf.ptr) {
	// 		error("Unable to allocate scale4x intermediate buffer");
	// 	}
	// }
	// scale2x(buf.ptr, buf.pitch, src, srcPitch, w, h);
	// scale2x(dst, dstPitch, buf.ptr, buf.pitch, buf.w, buf.h);
}

const scaleNx = (factor: number, dst: Uint32Array, dstPitch: number, src: Uint32Array, srcPitch: number, w: number, h: number) => {
	switch (factor) {
	case 2:
		return scale2x(dst, dstPitch, src, srcPitch, w, h);
	case 3:
		return scale3x(dst, dstPitch, src, srcPitch, w, h);
	case 4:
		return scale4x(dst, dstPitch, src, srcPitch, w, h);
	}
}

const _internalScaler: Scaler  = {
	tag: SCALER_TAG,
	name: "scaleNx",
	factorMin: 2,
	factorMax: 4,
	scale: scaleNx,
}


export { ScalerType, Scaler, ScaleProc32, _internalScaler }