import Phaser from 'phaser'

const fragmentShader = `
precision mediump float;

uniform vec2 resolution;
uniform float time;
uniform float intensity;
uniform float opacity;

varying vec2 fragCoord;

float random(vec2 st) {
	return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
	vec2 uv = fragCoord / resolution.xy;

	float scan = smoothstep(0.0, 1.0, sin((uv.y + time * 0.08) * resolution.y * 1.25) * 0.5 + 0.5);
	float noise = random(vec2(
		floor(fragCoord.x * 0.35) + time * 10.0,
		floor(fragCoord.y * 0.35) - time * 5.0
	));

	float glow = clamp(scan * 0.65 + noise * 0.35, 0.0, 1.0);
	float fadeTop = smoothstep(0.0, 0.15, uv.y);
	float fadeBottom = smoothstep(0.0, 0.25, 1.0 - uv.y);
	float fade = fadeTop * fadeBottom;
	float alpha = intensity * fade * (0.4 + glow * 0.6) * opacity;

	vec3 tint = vec3(0.55, 0.95, 0.75);
	vec3 color = tint * (0.45 + glow * 0.55) * intensity;

	gl_FragColor = vec4(color, alpha);
}
`

const CrtOverlayShader = new Phaser.Display.BaseShader('crt-overlay', fragmentShader, undefined, {
	intensity: { type: '1f', value: 0.2 },
	opacity: { type: '1f', value: 0 },
})

export default CrtOverlayShader
