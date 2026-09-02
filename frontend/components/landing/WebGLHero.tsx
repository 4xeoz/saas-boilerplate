"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  varying vec2 v_uv;

  #define PI 3.14159265359

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float bottom = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x);
    float top = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), local.x);
    return mix(bottom, top, local.y);
  }

  void main() {
    vec2 pixel = gl_FragCoord.xy;
    float scale = min(u_resolution.x, u_resolution.y);
    vec2 uv = (pixel - 0.5 * u_resolution) / scale;
    vec2 pointer = (u_pointer - 0.5 * u_resolution) / scale;
    float time = u_time * 0.22;

    uv -= pointer * 0.055;
    float radius = length(uv);
    float angle = atan(uv.y, uv.x);
    float atmosphere = noise(uv * 3.2 + vec2(time, -time));
    vec2 warped = uv + 0.035 * vec2(
      noise(uv * 4.0 + time),
      noise(uv * 4.0 - time)
    );
    float warpedRadius = length(warped);

    vec3 color = vec3(0.018, 0.035, 0.028);
    color += vec3(0.08, 0.23, 0.12) * exp(-radius * 3.2);
    color += vec3(0.02, 0.19, 0.17) * exp(-length(uv - pointer * 0.35) * 6.0);

    for (int index = 0; index < 3; index += 1) {
      float phase = float(index) * (PI * 2.0 / 3.0);
      float orbit = 0.34 + sin(angle * 2.0 + time * 2.0 + phase) * 0.045;
      float ribbon = exp(-abs(warpedRadius - orbit) * 90.0);
      float shimmer = 0.65 + 0.35 * sin(angle * 5.0 - time * 4.0 + phase);
      vec3 ribbonColor = mix(
        vec3(0.60, 0.98, 0.34),
        vec3(0.17, 0.84, 0.76),
        0.5 + 0.5 * sin(angle + phase)
      );
      color += ribbonColor * ribbon * shimmer * 0.32;
    }

    float halo = exp(-abs(warpedRadius - 0.43) * 45.0);
    color += vec3(0.36, 0.84, 0.43) * halo * 0.18;

    float core = exp(-pow(radius / 0.22, 2.0) * 2.2);
    float coreLight = 0.7 + 0.3 * sin(time * 6.0);
    color += mix(vec3(0.48, 0.98, 0.34), vec3(0.18, 0.72, 0.63), atmosphere) * core * coreLight;

    float pulse = exp(-abs(radius - (0.16 + 0.025 * sin(time * 4.0))) * 95.0);
    color += vec3(0.72, 1.0, 0.56) * pulse * 0.3;

    vec2 starsCell = floor((uv + 1.0) * 18.0);
    float star = step(0.992, hash(starsCell));
    float starFade = smoothstep(0.85, 0.15, radius) * (0.5 + 0.5 * sin(time * 5.0 + hash(starsCell) * 12.0));
    color += vec3(0.64, 0.95, 0.68) * star * starFade * 0.8;

    float grid = smoothstep(0.97, 1.0, sin(uv.x * 90.0) * sin(uv.y * 90.0));
    color += vec3(0.12, 0.35, 0.18) * grid * 0.025;

    float vignette = smoothstep(0.92, 0.18, radius);
    color *= vignette;
    color = pow(max(color, 0.0), vec3(0.92));
    gl_FragColor = vec4(color, 0.98);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create WebGL program");

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

export default function WebGLHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch (error) {
      console.warn("Re-entry WebGL hero unavailable", error);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const buffer = gl.createBuffer();

    if (
      positionLocation < 0 ||
      !resolutionLocation ||
      !pointerLocation ||
      !timeLocation ||
      !buffer
    ) {
      gl.deleteProgram(program);
      return;
    }

    const surface: HTMLCanvasElement = canvas;
    const context: WebGLRenderingContext = gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    let width = 1;
    let height = 1;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let animationFrame = 0;

    function resize() {
      const bounds = surface.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width * pixelRatio));
      height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
        context.viewport(0, 0, width, height);
      }
    }

    function updatePointer(event: PointerEvent) {
      const bounds = surface.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
      pointerY = 1 - (event.clientY - bounds.top) / Math.max(bounds.height, 1);
    }

    function resetPointer() {
      pointerX = 0.5;
      pointerY = 0.5;
    }

    function render(now: number) {
      resize();
      context.uniform2f(resolutionLocation, width, height);
      context.uniform2f(pointerLocation, pointerX * width, pointerY * height);
      context.uniform1f(timeLocation, now * 0.001);
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
      animationFrame = window.requestAnimationFrame(render);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(surface);
    surface.addEventListener("pointermove", updatePointer);
    surface.addEventListener("pointerleave", resetPointer);
    resize();
    resetPointer();
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      surface.removeEventListener("pointermove", updatePointer);
      surface.removeEventListener("pointerleave", resetPointer);
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(159,232,112,0.17),transparent_22%),radial-gradient(circle_at_18%_65%,rgba(24,119,93,0.16),transparent_30%),linear-gradient(135deg,#09110c_0%,#07100d_48%,#09140c_100%)]" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(7,16,11,0.1)_55%,rgba(7,16,11,0.86)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#08110b] to-transparent" />
    </div>
  );
}
