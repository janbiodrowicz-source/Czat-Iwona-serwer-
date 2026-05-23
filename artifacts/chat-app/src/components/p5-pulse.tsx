import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import p5 from "p5";

export interface P5PulseRef {
  trigger: () => void;
}

export const P5Pulse = forwardRef<P5PulseRef, {}>((_, ref) => {
  const isPulsing = useRef(false);
  const pulseRadius = useRef(0);

  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;inset:0;z-index:0;pointer-events:none;";
    document.body.appendChild(el);

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.clear();
      };

      p.draw = () => {
        p.clear();
        if (isPulsing.current) {
          p.noFill();
          const alpha = p.map(pulseRadius.current, 0, p.windowWidth, 0.5, 0);
          p.stroke(`rgba(0, 255, 255, ${alpha})`);
          p.strokeWeight(2);
          p.circle(40, p.windowHeight - 100, pulseRadius.current);
          pulseRadius.current += 15;
          if (pulseRadius.current > p.windowWidth) {
            isPulsing.current = false;
            pulseRadius.current = 0;
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    };

    const p5Instance = new p5(sketch, el);

    return () => {
      p5Instance.remove();
      document.body.removeChild(el);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    trigger: () => {
      isPulsing.current = true;
      pulseRadius.current = 0;
    },
  }));

  return null;
});
P5Pulse.displayName = "P5Pulse";
