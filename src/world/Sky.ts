import * as THREE from 'three';

export class Sky {
  mesh: THREE.Mesh;
  sun: THREE.DirectionalLight;
  private uniforms: {
    sunDir: { value: THREE.Vector3 };
    dayFactor: { value: number };
  };

  constructor(scene: THREE.Scene) {
    this.uniforms = {
      sunDir:    { value: new THREE.Vector3(0.4, 0.6, 0.2).normalize() },
      dayFactor: { value: 1.0 }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 sunDir;
        uniform float dayFactor;
        varying vec3 vWorld;

        void main() {
          vec3 dir = normalize(vWorld);
          float h = clamp(dir.y, 0.0, 1.0);
          float sun = max(dot(dir, sunDir), 0.0);

          vec3 zenith  = vec3(0.10, 0.30, 0.72);
          vec3 horizon = vec3(0.55, 0.72, 0.92);
          vec3 night   = vec3(0.02, 0.04, 0.10);

          vec3 skyDay   = mix(horizon, zenith, pow(h, 0.55));
          vec3 skyNight = mix(night * 0.5, night, pow(h, 0.55));
          vec3 col = mix(skyNight, skyDay, dayFactor);

          // Güneş disk ve halo
          float sunDisk = pow(sun, 800.0) * 3.0;
          float sunHalo = pow(sun, 12.0) * 0.35;
          col += vec3(1.0, 0.85, 0.55) * (sunDisk + sunHalo) * dayFactor;

          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), mat);
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
    this.sun.position.set(400, 800, 200);
    scene.add(this.sun);
  }

  update(cameraPos: THREE.Vector3): void {
    this.mesh.position.copy(cameraPos);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.uniforms.sunDir.value.copy(dir).normalize();
    this.sun.position.copy(dir).multiplyScalar(1000);
    const dayFactor = Math.max(0, Math.min(1, dir.y * 3 + 0.2));
    this.uniforms.dayFactor.value = dayFactor;
    this.sun.intensity = 2.5 * dayFactor;
  }
}
