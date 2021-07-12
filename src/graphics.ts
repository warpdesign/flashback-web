import { Point } from "./intern"

let polygon = 0

class Graphics {
    static AREA_POINTS_SIZE = 256 * 2
    _layer: Uint8Array
    _layerPitch: number
    _areaPoints = new Int16Array(Graphics.AREA_POINTS_SIZE * 2)
    _crx: number
    _cry: number
    _crw: number
    _crh: number

    static calcPolyStep1(dx: number, dy: number) {
        if (dy === 0) {
            throw(`Assertion failed: ${dy} !== 0`)
        }
        let a = dx * 256
        if ((a >> 16) < dy) {
            a = ((a / dy) >> 0) * 256
        } else {
            a = ((((((a / 256) >> 0)/ dy) >> 0)) >> 0) & 0xFFFF0000
        }
        return a
    }

    static calcPolyStep2(dx: number, dy: number) {
        if (dy === 0) {
            throw(`Assertion failed: ${dy} !== 0`)
        }
        let a = dx * 256
        if ((a >> 16) < dy) {
            a = ((a / dy) >> 0) * 256
        } else {
            a = ((((a / 256) >> 0) / dy)) >> 0 << 16
        }
        return a
    }

    drawPolygonHelper1(x: number, y: number, step: number, pts: number, start: number) {
        const points = this._areaPoints
        let first = true
        x = points[pts]
        y = points[pts + 1]
        let dy, dx
        do {
            if (first) {
                first = false
            } else {
                x = points[pts]
            }
            --pts
            dy = points[pts] - y
            --pts
            dx = points[pts] - x
        } while (dy <= 0 && start < pts)
        x <<= 16
        if (dy > 0) {
            step = Graphics.calcPolyStep1(dx, dy)
        }
        return {
            x,
            y,
            step,
            pts, start
        }
    }

    drawPolygonHelper2(x: number, y: number, step: number, pts: number, start: number) {
        const points = this._areaPoints
        let first = true
        x = points[start++]
        y = points[start++]
        let dy, dx
        do {
            if (first) {
                first = false
            } else {
                x = points[start]
                start += 2
            }
            dy = points[start + 1] - y
            dx = points[start] - x
        } while (dy <= 0 && start < pts)
        x <<= 16
        if (dy > 0) {
            step = Graphics.calcPolyStep2(dx, dy)
        }
        return {
            x,
            y,
            step,
            pts,
            start
        }
    }

    setLayer(layer: Uint8Array, pitch: number) {
        this._layer = layer
        this._layerPitch = pitch
    }

    setClippingRect(rx: number, ry: number, rw: number, rh: number) {
        this._crx = rx
        this._cry = ry
        this._crw = rw
        this._crh = rh
    }

    addEllipseRadius(y: number, x1: number, x2: number) {
        if (y >= 0 && y <= this._crh) {
            y = (y - this._areaPoints[0]) * 2
            if (x1 < 0) {
                x1 = 0
            }
            if (x2 >= this._crw) {
                x2 = this._crw - 1
            }
            this._areaPoints[y + 1] = x1
            this._areaPoints[y + 2] = x2
        }
    }

    drawEllipse(color: number, hasAlpha: boolean, pt: Point, rx: number, ry: number) {
        let flag = false
        let y = pt.y - ry
        if (y < 0) {
            y = 0
        }
        if (y < this._crh) {
            if (pt.y + ry >= 0) {
                this._areaPoints[0] = y
                let dy = 0
                let rxsq  = rx * rx
                let rxsq2 = rx * rx * 2
                let rxsq4 = rx * rx * 4
                let rysq  = ry * ry
                let rysq2 = ry * ry * 2
                let rysq4 = ry * ry * 4
    
                let dx = 0
                let b = rx * ((rysq2 & 0xFFFF) + (rysq2 >> 16))
                let a = 2 * b
    
                let ny1, ny2, nx1, nx2
                ny1 = ny2 = rysq4 / 2 - a + rxsq
                nx1 = nx2 = rxsq2 - b + rysq
    
                while (ny2 < 0) {
                    let x2 = pt.x + rx
                    let x1 = pt.x - rx
                    let by = pt.y + dy
                    let ty = pt.y - dy
                    if (x1 !== x2) {
                        this.addEllipseRadius(by, x1, x2)
                        if (ty < by) {
                            this.addEllipseRadius(ty, x1, x2)
                        }
                    }
                    dy += 1
                    dx += rxsq4
                    nx1 = dx
                    if (nx2 < 0) {
                        nx2 += nx1 + rxsq2
                        ny2 += nx1
                    } else {
                        --rx
                        a -= rysq4
                        ny1 = a
                        nx2 += nx1 + rxsq2 - ny1
                        ny2 += nx1 + rysq2 - ny1
                    }
                }
    
                while (rx >= 0) {
                    let flag2 = false
                    let x2 = pt.x + rx
                    let x1 = pt.x - rx
                    let by = pt.y + dy
                    let ty = pt.y - dy
                    if (!flag && x1 !== x2) {
                        flag2 = true
                        this.addEllipseRadius(by, x1, x2)
                        if (ty < by) {
                            this.addEllipseRadius(ty, x1, x2)
                        }
                    }
                    if (flag2) {
                        flag = true
                    }
                    --rx
                    a -= rysq4
                    nx1 = a
                    if (ny2 < 0) {
                        ++dy
                        flag = false
                        dx += rxsq4
                        ny2 += dx - nx1 + rysq2
                        ny1 = dx - nx1 + rysq2
                    } else {
                        ny2 += rysq2 - nx1
                        ny1 = rysq2 - nx1
                    }
                }
                if (flag) {
                    ++dy
                }
    
                while (dy <= ry) {
                    let ty = pt.y - dy
                    let by = pt.y + dy
                    if (ty < by) {
                        this.addEllipseRadius(ty, pt.x, pt.x)
                    }
                    this.addEllipseRadius(by, pt.x, pt.x)
                    ++dy
                }
                y = pt.y + ry + 1
                if (y > this._crh) {
                    y = this._crh
                }
                y = (y - this._areaPoints[0]) * 2
                this._areaPoints[y + 1] = -1
                this.fillArea(color, hasAlpha)
            }
        }
    }

    fillArea(color: number, hasAlpha: boolean) {
        const _areaPoints = this._areaPoints
        const _layer = this._layer
        let pts = 0
        let dst = (this._cry + _areaPoints[pts++]) * this._layerPitch + this._crx
        let x1 = _areaPoints[pts++]
        if (x1 >= 0) {
            if (hasAlpha && color > 0xC7) {
                do {
                    const x2 = Math.min(this._crw - 1, _areaPoints[pts++])
                    for (; x1 <= x2; ++x1) {
                        _layer[dst + x1] |= color & 8
                    }
                    dst += this._layerPitch
                    x1 = _areaPoints[pts++]
                } while (x1 >= 0)
            } else {
                do {
                    const x2 = Math.min(this._crw - 1, _areaPoints[pts++])
                    if (x1 <= x2) {
                        const len = x2 - x1 + 1
                        _layer.fill(color, dst + x1, dst + x1 + len)
                    }
                    dst += this._layerPitch
                    x1 = _areaPoints[pts++]
                } while (x1 >= 0)
            }
        }
    }

    drawSegment(color: number, hasAlpha: boolean, ys: number, pts: Point[], numPts: number) {
        let xmin, xmax, ymin, ymax
        xmin = xmax = pts[0].x
        ymin = ymax = pts[0].y
        for (let i = 1; i < numPts; ++i) {
            let x = pts[i].x
            let y = pts[i].y
            if ((xmin << 16) + ymin > (x << 16) + y) {
                xmin = x
                ymin = y
            }
            if ((xmax << 16) + ymax < (x << 16) + y) {
                xmax = x
                ymax = y
            }
        }
        if (xmin < 0) {
            xmin = 0
        }
        if (xmax >= this._crw) {
            xmax = this._crw - 1;
        }
        this._areaPoints[0] = ys
        this._areaPoints[1] = xmin
        this._areaPoints[2] = xmax
        this._areaPoints[3] = -1
        this.fillArea(color, hasAlpha)
    }

    drawPoint(color: number, pt: Point, hasAlpha = false) {
        if (pt.x >= 0 && pt.x < this._crw && pt.y >= 0 && pt.y < this._crh) {
            if (hasAlpha && color > 0xC7) {
                this._layer[(pt.y + this._cry) * this._layerPitch + pt.x + this._crx] |= color & 8
            } else {
                this._layer[(pt.y + this._cry) * this._layerPitch + pt.x + this._crx] = color
            }
        }
    }

    drawLine(color: number, pt1: Point, pt2: Point) {
        let dxincr1 = 1
        let dyincr1 = 1
        let dx = pt2.x - pt1.x;
        if (dx < 0) {
            dxincr1 = -1
            dx = -dx
        }
        let dy = pt2.y - pt1.y
        if (dy < 0) {
            dyincr1 = -1
            dy = -dy
        }
        let dxincr2, dyincr2, delta1, delta2
        if (dx < dy) {
            dxincr2 = 0
            dyincr2 = 1
            delta1 = dx
            delta2 = dy
            if (dyincr1 < 0) {
                dyincr2 = -1
            }
        } else {
            dxincr2 = 1
            dyincr2 = 0
            delta1 = dy
            delta2 = dx
            if (dxincr1 < 0) {
                dxincr2 = -1
            }
        }
        const pt:Point = {
            x: pt1.x,
            y: pt1.y,
        }

        let octincr1 = delta1 * 2 - delta2 * 2
        let octincr2 = delta1 * 2
        let oct = delta1 * 2 - delta2
        if (delta2 >= 0) {
            this.drawPoint(color, pt)
            while (--delta2 >= 0) {
                if (oct >= 0) {
                    pt.x += dxincr1
                    pt.y += dyincr1
                    oct += octincr1
                } else {
                    pt.x += dxincr2
                    pt.y += dyincr2
                    oct += octincr2
                }
                this.drawPoint(color, pt)
            }
        }
    }

    drawPolygon(color: number, hasAlpha: boolean, pts: Point[], numPts: number) {
        if (numPts * 4 >= 0x100) {
            throw(`Assertion failed: ${numPts * 4} < 0x100`)
        }

        const points = this._areaPoints
        let apts1 = Graphics.AREA_POINTS_SIZE
        let apts2 = Graphics.AREA_POINTS_SIZE + numPts * 2

        let xmin, xmax, ymin, ymax
        xmin = xmax = pts[0].x
        ymin = ymax = pts[0].y

        let spts = apts1
        points[apts1++] = points[apts2++] = pts[0].x
        points[apts1++] = points[apts2++] = pts[0].y

        for (let p = 1; p < numPts; ++p) {
            let x = pts[p].x
            let y = pts[p].y

            if (ymin > y) {
                ymin = y
                spts = apts1
            }
            if (ymax < y) {
                ymax = y
            }
            points[apts1++] = points[apts2++] = x
            points[apts1++] = points[apts2++] = y

            if (xmin > x) {
                xmin = x
            }
            if (xmax < x) {
                xmax = x
            }
        }
        let rpts = 0
        if (xmax < 0 || xmin >= this._crw || ymax < 0 || ymin >= this._crh) {
            return
        }
        if (numPts === 2) {
            this.drawLine(color, pts[0], pts[1])
            return
        }

        if (ymax === ymin) {
            this.drawSegment(color, hasAlpha, ymax, pts, numPts)
            return
        }

        const gfx_fillArea = () => {
            points[rpts++] = -1
            this.fillArea(color, hasAlpha)
        
            return 0
        }

        const gfx_drawPolygonEnd = () => {
            dy = ymax - ymin
            if (dy >= 0) {
                do {
                    a = b
                    if (a < 0) {
                        a = 0
                    }
                    x = f >> 16
                    if (x > xmax) {
                        x = xmax
                    }
                    points[rpts++] = a >> 16
                    points[rpts++] = x
                    b += xstep1
                    f += xstep2
                    --dy
                } while (dy >= 0)
            }
            return gfx_fillArea()
        }

        const gfx_endLine = () => {
            d = xstep1
            if (d >= 0) {
                if (d >= l1) {
                    d = (d / 2) >> 0
                    b -= d
                }
            }
            d = xstep2
            if (d < 0) {
                d = (d / 2) >> 0
                f -= d
            }
            a = b
            if (a < 0) {
                a = 0
            }
            x = f >> 16
            if (x > xmax) {
                x = xmax
            }
            points[rpts++] = a >> 16
            points[rpts++] = x
            return gfx_fillArea()
        }

        const gfx_startNewLine = () => {
            let res = this.drawPolygonHelper2(f, ymin, xstep2, apts1, spts)
            f = res.x
            ymin = res.y
            xstep2 = res.step
            apts1 = res.pts
            spts = res.start

            if (spts >= apts1) {
                b = points[apts1] << 16
                dy = points[apts1 + 1]
                if (dy <= ymax) {
                    return gfx_endLine()
                }
                return gfx_fillArea()
            }
            res = this.drawPolygonHelper1(b, ymin, xstep1, apts1, spts)
            b = res.x
            ymin = res.y
            xstep1 = res.step
            apts1 = res.pts
            spts = res.start
            d = xstep1
            if (d < 0) {
                if (d >= l2) {
                    d = l1
                }
                d = (d / 2) >> 0
                b += d
            }
            d = xstep2
            if (d >= 0) {
                if (d <= l1) {
                    d = l1
                }
                d = (d / 2) >> 0
                f += d
            }
            d = b
            if (d < 0) {
                d = 0
            }
            x = f >> 16
            if (x > xmax) {
                x = xmax
            }
            points[rpts++] = d >> 16
            points[rpts++] = x
            ++ymin
            d = xstep1
            if (d >= 0) {
                if (d <= l1) {
                    d = l1
                }
                d = (d / 2) >> 0
            }
            b += d
            d = xstep2
            if (d < 0) {
                if (d >= l2) {
                    d = l1
                }
                d /= 2
            }
            f += d

            return gfx_startLine()
        }

        const gfx_startLine = () => {
            while (1) {
                dy = points[apts1 + 1]
                if (spts >= apts1) {
                    break
                } else if (dy > points[spts + 1]) {
                    dy = points[spts + 1]
                    if (dy > ymax) {
                        return gfx_drawPolygonEnd()
                    }
                    dy -= ymin
                    if (dy > 0) {
                        --dy
                        do {
                            a = b
                            if (a < 0) {
                                a = 0
                            }
                            x = f >> 16
                            if (x > xmax) {
                                x = xmax
                            }
                            points[rpts++] = a >> 16
                            points[rpts++] = x
                            b += xstep1
                            f += xstep2
                            --dy
                        } while (dy >= 0)
                    }
                    const res = this.drawPolygonHelper2(f, ymin, xstep2, apts1, spts)
                    f = res.x
                    ymin = res.y
                    xstep2 = res.step
                    apts1 = res.pts
                    spts = res.start
                    d = xstep2
                    if (d >= 0) {
                        if (d <= l1) {
                            d = l1
                        }
                        d = (d / 2) >> 0
                        f += d
                    } else {
                        d = b
                        if (d < 0) {
                            d = 0
                        }
                        x = f >> 16
                        if (x > xmax) {
                            x = xmax
                        }
                        points[rpts++] = d >> 16
                        points[rpts++] = x
                        ++ymin
                        d = xstep2
                        if (d >= l2) {
                            d = l1
                        }
                        d = (d / 2) >> 0
                        f += d
                        b += xstep1
                    }
                } else if (dy == points[spts + 1]) {
                    if (dy > ymax) {
                        return gfx_drawPolygonEnd()
                    }
                    dy -= ymin
                    if (dy > 0) {
                        --dy
                        do {
                            a = b
                            if (a < 0) {
                                a = 0
                            }
                            x = f >> 16
                            if (x > xmax) {
                                x = xmax
                            }
                            points[rpts++] = a >> 16
                            points[rpts++] = x
                            b += xstep1
                            f += xstep2
                            --dy
                        } while (dy >= 0)
                    }
                    return gfx_startNewLine()
                } else if (dy > ymax) {
                    return gfx_drawPolygonEnd()
                } else {
                    dy -= ymin
                    if (dy > 0) {
                        --dy
                        do {
                            a = b
                            if (a < 0) {
                                a = 0
                            }
                            x = f >> 16
                            if (x > xmax) {
                                x = xmax
                            }
                            points[rpts++] = a >> 16
                            points[rpts++] = x
                            b += xstep1
                            f += xstep2
                            --dy
                        } while (dy >= 0)
                    }
                    const res = this.drawPolygonHelper1(b, ymin, xstep1, apts1, spts)
                    b = res.x
                    ymin = res.y
                    xstep1 = res.step
                    apts1 = res.pts
                    spts = res.start
                    d = xstep1
                    if (d < 0) {
                        if (d >= l2) {
                            d = l1
                        }
                        d = (d / 2) >> 0
                        b += d
                    } else {
                        d = b
                        if (d < 0) {
                            d = 0
                        }
                        x = f >> 16
                        if (x > xmax) {
                            x = xmax
                        }
                        points[rpts++] = d >> 16
                        points[rpts++] = x
                        ++ymin
                        d = xstep1
                        if (d <= l1) {
                            d = l1
                        }
                        d = (d / 2) >> 0
                        b += d
                        f += xstep2
                    }
                }
            }
        
            if (dy > ymax) {
                return gfx_drawPolygonEnd()
            }
            dy -= ymin
            if (dy < 0) {
                return gfx_fillArea()
            }

            if (dy > 0) {
                --dy
                do {
                    a = b
                    if (a < 0) {
                        a = 0
                    }
                    x = f >> 16
                    if (x > xmax) {
                        x = xmax
                    }
                    points[rpts++] = a >> 16
                    points[rpts++] = x
                    b += xstep1
                    f += xstep2
                    --dy
                } while (dy >= 0)
            }
        
            b = f = (points[apts1] << 16) | points[apts1 + 1]

            return gfx_endLine()
        }

        let x, dx, y, dy
        let a, b, d, f
        let xstep1 = 0
        let xstep2 = 0

        apts1 = spts + (numPts * 2)
        xmax = this._crw - 1
        ymax = this._crh - 1
        let l1 = 65536
        let l2 = -65536
        if (ymin < 0) {
            let x0, y0
            do {
                --apts1
                y0 = points[apts1]
                --apts1
                x0 = points[apts1]
            } while (y0 < 0)
            x = points[apts1 + 2]
            y = points[apts1 + 3]
            dy = y0 - y
            dx = x0 - x
            xstep1 = (dy << 16) | dx

            if (dy === 0) {
                throw(`Assertion failed: ${dy} !== 0`)
            }
            a = (y * dx / dy) >> 0
            b = (x - a) << 16
            d = xstep1 = Graphics.calcPolyStep1(dx, dy)

            if (d < 0) {
                d = -d
            }
            if (d < l1) {
                d = l2
            }
            d = (d / 2) >> 0
            b -= d

            do {
                x0 = points[spts++]
                y0 = points[spts++]
            } while (points[spts + 1] < 0)

            dy = points[spts + 1] - y0
            dx = points[spts] - x0
            xstep2 = (dy << 16) | dx

            if (dy === 0) {
                throw(`Assertion failed: ${dy} !== 0`)
            }
            a = (y0 * dx / dy) >> 0
            f = (x0 - a) << 16
            d = xstep2 = Graphics.calcPolyStep2(dx, dy)
            if (d < 0) {
                d = -d
            }
            if (d < l1) {
                d = l1
            }
            d = (d / 2) >> 0
            f += d
            ymin = 0
            points[rpts++] = 0
            return gfx_startLine()            
        }
        points[rpts++] = ymin

        return gfx_startNewLine()
    }
}

export { Graphics }
