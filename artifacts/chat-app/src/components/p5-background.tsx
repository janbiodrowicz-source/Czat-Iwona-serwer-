import { useEffect } from "react";
import p5 from "p5";

export function P5Background() {
  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.6;";
    document.body.appendChild(el);

    const sketch = (p: p5) => {
      let particles: Particle[] = [];

      class Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        color: p5.Color;

        constructor() {
          this.x = p.random(p.width);
          this.y = p.random(p.height);
          this.vx = p.random(-0.5, 0.5);
          this.vy = p.random(-0.5, 0.5);
          this.size = p.random(1, 3);
          const hue = p.random(260, 300);
          this.color = p.color(`hsla(${hue}, 100%, 65%, 0.3)`);
        }

        update() {
          this.x += this.vx;
          this.y += this.vy;
          if (this.x < 0) this.x = p.width;
          if (this.x > p.width) this.x = 0;
          if (this.y < 0) this.y = p.height;
          if (this.y > p.height) this.y = 0;
        }

        draw() {
          p.noStroke();
          p.fill(this.color);
          p.circle(this.x, this.y, this.size);
        }
      }

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        const numParticles = p.windowWidth < 768 ? 40 : 100;
        for (let i = 0; i < numParticles; i++) {
          particles.push(new Particle());
        }
      };

      p.draw = () => {
        p.clear();
        particles.forEach((particle, i) => {
          particle.update();
          particle.draw();
          for (let j = i + 1; j < particles.length; j++) {
            const other = particles[j];
            const d = p.dist(particle.x, particle.y, other.x, other.y);
            if (d < 100) {
              p.stroke(`rgba(150, 100, 255, ${p.map(d, 0, 100, 0.2, 0)})`);
              p.strokeWeight(1);
              p.line(particle.x, particle.y, other.x, other.y);
            }
          }
        });
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    };

    const myP5 = new p5(sketch, el);

    return () => {
      myP5.remove();
      document.body.removeChild(el);
    };
  }, []);

  return null;
}
