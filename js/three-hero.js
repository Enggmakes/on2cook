/**
 * On2Cook Ambassador Network — three-hero.js
 * 3D Interactive Culinary Tech Visualizer using Three.js
 * Represents the dual-energy hybrid cooking innovation (Flame + Wave)
 */

(function () {
  "use strict";

  function initThreeHero() {
    var container = document.getElementById("threeHeroCanvas");
    if (!container || typeof THREE === "undefined") return;

    var width = container.clientWidth || 400;
    var height = container.clientHeight || 400;

    // Scene, Camera, Renderer
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 28;

    var renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Group for all rotating objects
    var coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // 1. Dual Energy Ring: Flame Ring (Outer Red-Orange)
    var ringGeo1 = new THREE.TorusGeometry(8, 0.18, 16, 100);
    var ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    var flameRing = new THREE.Mesh(ringGeo1, ringMat1);
    coreGroup.add(flameRing);

    // 2. Dual Energy Ring: Wave Ring (Inner Cyan-Gold)
    var ringGeo2 = new THREE.TorusGeometry(6.2, 0.12, 16, 80);
    var ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xffa600,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    var waveRing = new THREE.Mesh(ringGeo2, ringMat2);
    waveRing.rotation.x = Math.PI / 3;
    coreGroup.add(waveRing);

    // 3. Central Core: Geometric Cooking Reactor
    var coreGeo = new THREE.IcosahedronGeometry(3.2, 2);
    var coreMat = new THREE.MeshStandardMaterial({
      color: 0x1a0505,
      emissive: 0xff2e00,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.85,
      wireframe: true
    });
    var centerCore = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(centerCore);

    // Inner Glowing Core sphere
    var glowGeo = new THREE.SphereGeometry(2.1, 32, 32);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.4
    });
    var glowSphere = new THREE.Mesh(glowGeo, glowMat);
    coreGroup.add(glowSphere);

    // 4. Floating Ambient Culinary Energy Particles
    var particleCount = 220;
    var particleGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(particleCount * 3);
    var colors = new Float32Array(particleCount * 3);

    var colorA = new THREE.Color(0xff3300); // On2Cook Flame
    var colorB = new THREE.Color(0xffaa00); // Wave Glow
    var colorC = new THREE.Color(0xffffff); // Star

    for (var i = 0; i < particleCount; i++) {
      var radius = 7.5 + Math.random() * 8.5;
      var theta = Math.random() * Math.PI * 2;
      var phi = (Math.random() - 0.5) * Math.PI;

      positions[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.sin(phi);
      positions[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);

      var mixColor = Math.random() > 0.6 ? colorB : (Math.random() > 0.3 ? colorA : colorC);
      colors[i * 3] = mixColor.r;
      colors[i * 3 + 1] = mixColor.g;
      colors[i * 3 + 2] = mixColor.b;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    var particleMat = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    var particleSystem = new THREE.Points(particleGeo, particleMat);
    coreGroup.add(particleSystem);

    // Lighting
    var pointLight1 = new THREE.PointLight(0xff4400, 3, 50);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    var pointLight2 = new THREE.PointLight(0xff9900, 2, 50);
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);

    var ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambLight);

    // Mouse Interaction
    var targetRotationX = 0;
    var targetRotationY = 0;
    var mouseX = 0;
    var mouseY = 0;

    function onMouseMove(e) {
      var rect = container.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      mouseX = (x / rect.width) * 2;
      mouseY = -(y / rect.height) * 2;
    }

    window.addEventListener("mousemove", onMouseMove);

    // Resize Handler
    function onResize() {
      if (!container) return;
      var w = container.clientWidth || 400;
      var h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    window.addEventListener("resize", onResize);

    // Animation Loop
    var clock = new THREE.Clock();
    var isVisible = true;

    // Observe visibility to throttle off-screen rendering
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        isVisible = entries[0].isIntersecting;
      }, { threshold: 0.1 });
      observer.observe(container);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!isVisible) return;

      var delta = clock.getDelta();
      var elapsedTime = clock.getElapsedTime();

      // Continuous rotation
      flameRing.rotation.z += 0.008;
      flameRing.rotation.x = Math.sin(elapsedTime * 0.4) * 0.35;

      waveRing.rotation.y += 0.012;
      waveRing.rotation.z = Math.cos(elapsedTime * 0.5) * 0.45;

      centerCore.rotation.x += 0.005;
      centerCore.rotation.y += 0.007;

      var pulse = 1 + Math.sin(elapsedTime * 3) * 0.06;
      glowSphere.scale.set(pulse, pulse, pulse);

      particleSystem.rotation.y -= 0.003;
      particleSystem.rotation.x += 0.001;

      // Mouse parallax easing
      targetRotationY += (mouseX * 0.45 - targetRotationY) * 0.05;
      targetRotationX += (mouseY * 0.45 - targetRotationX) * 0.05;

      coreGroup.rotation.y = targetRotationY;
      coreGroup.rotation.x = targetRotationX;

      renderer.render(scene, camera);
    }

    animate();
  }

  window.initThreeHero = initThreeHero;
})();
