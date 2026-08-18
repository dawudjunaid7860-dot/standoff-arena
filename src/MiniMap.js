export class MiniMap {
  constructor(canvas, arenaHalf, colliders) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.arenaHalf = arenaHalf;
    this.colliders = colliders;
    this.size = canvas.width;
  }

  _toCanvas(x, z) {
    return {
      x: ((x + this.arenaHalf) / (this.arenaHalf * 2)) * this.size,
      y: ((z + this.arenaHalf) / (this.arenaHalf * 2)) * this.size,
    };
  }

  update(playerPos, playerRotY, enemyPos, enemyVisible) {
    const ctx = this.ctx;
    const s = this.size;
    ctx.clearRect(0, 0, s, s);

    ctx.fillStyle = 'rgba(207, 171, 104, 0.5)';
    ctx.fillRect(0, 0, s, s);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (const c of this.colliders) {
      const min = this._toCanvas(c.minX, c.minZ);
      const max = this._toCanvas(c.maxX, c.maxZ);
      ctx.fillRect(min.x, min.y, Math.max(1, max.x - min.x), Math.max(1, max.y - min.y));
    }

    if (enemyVisible) {
      this._drawDot(enemyPos, '#ff5252');
    }
    this._drawDot(playerPos, '#3ddc71', playerRotY);
  }

  _drawDot(worldPos, color, facingY) {
    const ctx = this.ctx;
    const p = this._toCanvas(worldPos.x, worldPos.z);

    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (facingY !== undefined) {
      const dx = Math.sin(facingY);
      const dz = Math.cos(facingY);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - dx * 9, p.y - dz * 9);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
