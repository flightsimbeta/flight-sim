import * as THREE from 'three';

export interface MeshOptions {
  primary?: number;
  accent?: number;
}

export function buildAircraftMesh(opts: MeshOptions = {}): THREE.Group {
  const g = new THREE.Group();
  const primary = opts.primary ?? 0xf1f4f8;
  const accent  = opts.accent  ?? 0xd93b3b;

  const mWhite = new THREE.MeshStandardMaterial({ color: primary, metalness: 0.5, roughness: 0.35 });
  const mRed   = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.45, roughness: 0.4 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x14212e, metalness: 0.95, roughness: 0.08 });
  const mMetal = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.9, roughness: 0.25 });
  const mTire  = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.95 });

  // Gövde
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 5.6, 6, 18), mWhite);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Burun
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.6, 18), mRed);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.0;
  g.add(nose);

  // Kokpit camı
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.82, 18, 12), mGlass);
  cockpit.scale.set(1, 0.66, 1.9);
  cockpit.position.set(0, 0.72, -1.0);
  g.add(cockpit);

  // Ana kanat
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.0, 0.30, 2.4), mWhite);
  wing.position.set(0, -0.18, 0.4);
  g.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 2.4), mRed);
    tip.position.set(s * 6.4, -0.18, 0.4);
    g.add(tip);
  }

  // Dikey stabilize
  const vT = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.4, 1.8), mRed);
  vT.position.set(0, 1.3, 3.2);
  g.add(vT);

  // Yatay stabilize
  const hT = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.24, 1.1), mWhite);
  hT.position.set(0, 0.3, 3.2);
  g.add(hT);

  // Motor nozulları + alev
  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.3, 14), mMetal);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(s * 1.5, -0.35, 2.1);
    g.add(noz);

    const fm = new THREE.MeshBasicMaterial({
      color: 0xffaa44, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.8, 12), fm);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(s * 1.5, -0.35, 3.8);
    g.add(fl);
    flames.push(fl);
  }

  // İniş takımı
  const wheels: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 8), mMetal);
    leg.position.set(s * 2.3, -0.95, -0.2);
    g.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.28, 12), mTire);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 2.3, -1.65, -0.2);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Burun tekeri
  const nLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.15, 8), mMetal);
  nLeg.position.set(0, -0.85, -3.3);
  g.add(nLeg);
  const nWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.22, 10), mTire);
  nWheel.rotation.z = Math.PI / 2;
  nWheel.position.set(0, -1.45, -3.3);
  g.add(nWheel);
  wheels.push(nWheel);

  g.userData.flames = flames;
  g.userData.wheels = wheels;
  return g;
}
