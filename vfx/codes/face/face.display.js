import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneBufferGeometry,
  Scene,
  ShaderMaterial,
  sRGBEncoding,
  TextureLoader,
  Vector3,
  VideoTexture,
  WebGLRenderTarget,
} from "three";
import { FaceMeshFaceGeometry } from "../../libs/face-filters/FaceMeshFaceGeometry";
import { FaceVideo } from "../../libs/face-filters/FaceVideo";
import { getShaders } from "../../libs/face-filters/getShaders";
import { load } from "@tensorflow-models/facemesh";
import * as TF from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

// require("@tensorflow/tfjs-backend-wasm");
// require("@tensorflow/tfjs-backend-cpu");

export const effect = async ({ mini, node }) => {
  let gl = await mini.ready.gl;
  let mounter = await mini.ready.mounter;

  // engine status
  let engineStatus = { pause: false };
  let switcherEl = gl.domElement;

  // size info
  let canvasAspect = 1;
  let baseResSize = window.innerWidth;
  let canvasSize = [baseResSize, baseResSize / canvasAspect];
  let videoSize = [360, 360 / canvasAspect];

  const FLIP_CAMERA_REQUIRED = true; // keep to true
  const faceGeometry = new FaceMeshFaceGeometry({
    useVideoTexture: true,
  });
  const faceWorldScene = new Scene();
  const faceWorldCamera = new OrthographicCamera(1, 1, 1, 1, -1000, 1000);
  mini.set("faceWorldScene", faceWorldScene);
  mini.set("faceWorldCamera", faceWorldCamera);

  let facevideo = new FaceVideo({
    width: videoSize[0],
    height: videoSize[1],
    mini,
    onChangeDeviceStore: () => {},
  });
  let videoEl = facevideo.videoEl;
  const videoTexture = new VideoTexture(videoEl);
  videoTexture.encoding = sRGBEncoding;

  let devices = await facevideo.listOutDevices();
  let [media, tfReady, model] = await Promise.all([
    facevideo.getMediaByDevice({
      device: devices.videoinput[0],
    }),
    TF.setBackend("webgl"),
    load({ maxFaces: 1 }),
  ]);

  const worldRenderTarget = new WebGLRenderTarget(
    canvasSize[0],
    canvasSize[1],
    {
      //
      encoding: sRGBEncoding,
    }
  );

  let displayBG = new BGDisplay({
    mini,
    FLIP_CAMERA_REQUIRED,
    faceWorldScene,
    videoTexture,
  });
  new TrackFace({
    mini,
    engineStatus,
    devices,
    facevideo,
    switcherEl,
    model,
    videoEl,
    FLIP_CAMERA_REQUIRED,
    faceGeometry,
  });

  new ResizeHandler({
    mini,
    gl,
    displayBG,
    worldRenderTarget,
    videoEl,
    faceWorldCamera,
    faceGeometry,
  });
  new RenderRTT({
    mini,
    gl,
    worldRenderTarget,
    faceWorldScene,
    faceWorldCamera,
    engineStatus,
  });
  new DisplayRTT({ mini, mounter, canvasAspect, worldRenderTarget });
  new MyFace({ mini, faceWorldScene, faceGeometry, videoTexture });
  new MyNose({ mini, faceWorldScene, faceGeometry, mini });
};

class BGDisplay {
  constructor({ mini, FLIP_CAMERA_REQUIRED, faceWorldScene, videoTexture }) {
    let displayBG = new Mesh(
      new PlaneBufferGeometry(3, 3, 2, 2),
      new MeshBasicMaterial({
        map: videoTexture,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
    );
    if (FLIP_CAMERA_REQUIRED) {
      displayBG.rotation.y = Math.PI;
    }
    faceWorldScene.add(displayBG);
    mini.onClean(() => {
      faceWorldScene.remove(displayBG);
    });

    return displayBG;
  }
}

class TrackFace {
  constructor({
    mini,
    engineStatus,
    devices,
    facevideo,
    switcherEl,
    model,
    videoEl,
    FLIP_CAMERA_REQUIRED,
    faceGeometry,
  }) {
    let currentDeviceIdx = 0;

    switcherEl.onclick = switcherEl.ontouchstart = () => {
      engineStatus.pause = true;
      currentDeviceIdx += 1;
      facevideo
        .getMediaByDevice({
          device:
            devices.videoinput[currentDeviceIdx % devices.videoinput.length],
        })
        .then(
          () => {
            engineStatus.pause = false;
          },
          () => {
            engineStatus.pause = false;
          }
        );
    };

    mini.onLoop(async () => {
      if (engineStatus.pause) {
        return;
      }

      model
        .estimateFaces(videoEl, false, FLIP_CAMERA_REQUIRED)
        .then((faces) => {
          if (faces.length > 0) {
            // update is heavy
            faceGeometry.update(faces[0], FLIP_CAMERA_REQUIRED);
          }
        });
    });
  }
}

class ResizeHandler {
  constructor({
    mini,
    gl,
    displayBG,
    worldRenderTarget,
    videoEl,
    faceWorldCamera,
    faceGeometry,
  }) {
    let resize = (width, height) => {
      const videoAspectRatio = width / height;
      const windowWidth = gl.domElement.width;
      const windowHeight = gl.domElement.height;
      const windowAspectRatio = windowWidth / windowHeight;
      let adjustedWidth;
      let adjustedHeight;
      if (videoAspectRatio > windowAspectRatio) {
        adjustedWidth = windowWidth;
        adjustedHeight = windowWidth / videoAspectRatio;
      } else {
        adjustedWidth = windowHeight * videoAspectRatio;
        adjustedHeight = windowHeight;
      }

      displayBG.geometry = new PlaneBufferGeometry(1 * width, 1 * height, 2, 2);

      worldRenderTarget.setSize(
        adjustedWidth, // * gl.getPixelRatio(),
        adjustedHeight // * gl.getPixelRatio()
      );
    };

    let resizeH = () => {
      needsUpdate = true;
    };
    window.addEventListener("resize", resizeH);
    mini.onClean(() => {
      window.removeEventListener("resize", resizeH);
    });

    let ww = 0;
    let hh = 0;
    let needsUpdate = false;
    mini.onLoop(async () => {
      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (ww !== w || hh !== h || needsUpdate) {
        needsUpdate = false;
        ww = w;
        hh = h;

        faceWorldCamera.left = -0.5 * w;
        faceWorldCamera.right = 0.5 * w;
        faceWorldCamera.top = 0.5 * h;
        faceWorldCamera.bottom = -0.5 * h;
        faceWorldCamera.updateProjectionMatrix();

        faceGeometry.setSize(w, h);
        resize(w, h);
      }
    });
  }
}

class RenderRTT {
  constructor({
    mini,
    gl,
    worldRenderTarget,
    faceWorldScene,
    faceWorldCamera,
    engineStatus,
  }) {
    mini.onLoop(() => {
      if (engineStatus.pause) {
        return;
      }
      let oriRTT = gl.getRenderTarget();
      gl.setRenderTarget(worldRenderTarget);
      gl.render(faceWorldScene, faceWorldCamera);
      gl.setRenderTarget(oriRTT);
    });
  }
}

class DisplayRTT {
  constructor({ mini, mounter, canvasAspect, worldRenderTarget }) {
    // display filter world
    let displayRTT = new Mesh(
      new PlaneBufferGeometry(10, 10 / canvasAspect, 2, 2),
      new MeshBasicMaterial({
        map: worldRenderTarget.texture,
      })
    );

    mounter.add(displayRTT);
    mini.onClean(() => {
      mounter.remove(displayRTT);
    });
  }
}

class MyFace {
  constructor({ faceWorldScene, faceGeometry, videoTexture, mini }) {
    // const colorTexture = new TextureLoader().load("/face-assets/mesh_map.jpg");
    const alphaTexture = new TextureLoader().load(
      "/face-assets/mask_watermark.png"
    );

    let faceMat = new ShaderMaterial({
      // roughness: 1.0,FaceMesh
      // metalness: 0.0,
      // color: 0x808080,
      // roughness: 0.8,
      // metalness: 0.1,
      // alphaMap: alphaTexture,
      // aoMap: aoTexture,
      // map: colorTexture,

      // roughnessMap: colorTexture,

      //
      transparent: true,
      side: DoubleSide,

      uniforms: {
        alphaMap: { value: alphaTexture },
        video: { value: videoTexture },
        time: { value: 0 },
        faceRotation: { value: new Euler() },
        tint: { value: new Color("#008dff") },
        intensity: { value: 6.5 },
      },
      vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;

    varying vec2 vMaskUv;
    attribute vec2 maskUV;
      void main (void) {
          vUv = uv;
          vMaskUv = maskUV;
          vNormal = normalMatrix * normal;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

      }
    `,
      fragmentShader: /* glsl */ `

    //
    varying vec2 vMaskUv;
    varying vec2 vUv;
    uniform sampler2D video;
    uniform sampler2D alphaMap;

    varying vec3 vNormal;
    uniform float time;
    uniform vec3 faceRotation;

    uniform vec3 tint;
    uniform float intensity;

    ${getShaders()}

    void main (void) {
      vec4 faceColor = texture2D(video, vUv);
      vec4 alphaMaskColor = texture2D(alphaMap, vMaskUv);

      float logoAlphaMaskFade = (alphaMaskColor.r + alphaMaskColor.g + alphaMaskColor.b) / 3.0;

      // vec3 rainbow = vec3(
      //   pattern(vNormal.rg * 1.70123 + -0.17 * cos(time * 0.05)),
      //   pattern(vNormal.gb * 1.70123 +  0.0 * cos(time * 0.05)),
      //   pattern(vNormal.br * 1.70123 +  0.17 * cos(time * 0.05))
      // );

      float maskFader = 1.0 - length((vMaskUv - 0.5) * 2.0);
      float smoothAlphaMasking = pow(maskFader, 1.5 - maskFader) * (1.0 - maskFader);
      smoothAlphaMasking = smoothAlphaMasking * intensity;

      float fbmFader = pattern((vNormal.yz) * 1.333 * 1.70123 + cos(time * 0.05));
      float cnoiseFader = abs(cnoise((faceColor.xyz + time * 0.53) * 1.333 * 1.70123 + cos(time * 0.05))) * 5.0;

      // float bb = 1.0 / 255.0;
      // vec3 golden = vec3(255.0 * bb, 255.0 * bb, 84.0 * bb);
      // vec3 cyan  = vec3(96.0 * bb, 255.0 * bb, 227.0 * bb);
      // vec3 pasturegreen  = vec3(0.0 * bb, 160.0 * bb, 87.0 * bb);

      vec3 taintColor = tint;
      gl_FragColor = vec4(faceColor.rgb + vec3(fbmFader * cnoiseFader) * taintColor * smoothAlphaMasking, logoAlphaMaskFade * smoothAlphaMasking);
    }
    `,
    });

    mini.onLoop(() => {
      faceMat.uniforms.time.value += 1 / 60;
    });

    let face = new Mesh(faceGeometry, faceMat);
    faceWorldScene.add(face);
    mini.onClean(() => {
      faceWorldScene.remove(face);
    });
  }
}

class MyNose {
  constructor({ faceWorldScene, faceGeometry, mini }) {
    // Create a red material for the nose.
    const noseMaterial = new MeshBasicMaterial({
      color: 0xff2010,
      wireframe: true,
      transparent: true,
    });

    const nose = new Mesh(new IcosahedronGeometry(30, 3), noseMaterial);
    nose.visible = false;
    nose.castShadow = nose.receiveShadow = true;

    faceWorldScene.add(nose);
    mini.onClean(() => {
      faceWorldScene.remove(nose);
    });

    mini.onLoop(() => {
      const track = faceGeometry.track(5, 45, 275);
      nose.position.lerp(track.position, 0.4);
      nose.rotation.setFromRotationMatrix(track.rotation);

      if (faceGeometry.currentFace) {
        let face = faceGeometry.currentFace;

        let sx = face.mesh[0][0] / face.scaledMesh[0][0];
        let sy = face.mesh[0][1] / face.scaledMesh[0][1];
        let sz = face.mesh[0][2] / face.scaledMesh[0][2];

        let s = sx + sy + sz;
        nose.scale.setScalar(s / 3);
        nose.visible = true;
      }
    });
  }
}

//

/*

`faces` is an array of objects describing each detected face, for example:

[
  {
    faceInViewConfidence: 1, // The probability of a face being present.
    boundingBox: { // The bounding box surrounding the face.
      topLeft: [232.28, 145.26],
      bottomRight: [449.75, 308.36],
    },
    mesh: [ // The 3D coordinates of each facial landmark.
      [92.07, 119.49, -17.54],
      [91.97, 102.52, -30.54],
      ...
    ],
    scaledMesh: [ // The 3D coordinates of each facial landmark, normalized.
      [322.32, 297.58, -17.54],
      [322.18, 263.95, -30.54]
    ],
    annotations: { // Semantic groupings of the `scaledMesh` coordinates.
      silhouette: [
        [326.19, 124.72, -3.82],
        [351.06, 126.30, -3.00],
        ...
      ],
      ...
    }
  }
]

// annotations
0: {name: "silhouette", howManyDots: 36, positions: Array(36)}
1: {name: "lipsUpperOuter", howManyDots: 11, positions: Array(11)}
2: {name: "lipsLowerOuter", howManyDots: 10, positions: Array(10)}
3: {name: "lipsUpperInner", howManyDots: 11, positions: Array(11)}
4: {name: "lipsLowerInner", howManyDots: 11, positions: Array(11)}
5: {name: "rightEyeUpper0", howManyDots: 7, positions: Array(7)}
6: {name: "rightEyeLower0", howManyDots: 9, positions: Array(9)}
7: {name: "rightEyeUpper1", howManyDots: 7, positions: Array(7)}
8: {name: "rightEyeLower1", howManyDots: 9, positions: Array(9)}
9: {name: "rightEyeUpper2", howManyDots: 7, positions: Array(7)}
10: {name: "rightEyeLower2", howManyDots: 9, positions: Array(9)}
11: {name: "rightEyeLower3", howManyDots: 9, positions: Array(9)}
12: {name: "rightEyebrowUpper", howManyDots: 8, positions: Array(8)}
13: {name: "rightEyebrowLower", howManyDots: 6, positions: Array(6)}
14: {name: "leftEyeUpper0", howManyDots: 7, positions: Array(7)}
15: {name: "leftEyeLower0", howManyDots: 9, positions: Array(9)}
16: {name: "leftEyeUpper1", howManyDots: 7, positions: Array(7)}
17: {name: "leftEyeLower1", howManyDots: 9, positions: Array(9)}
18: {name: "leftEyeUpper2", howManyDots: 7, positions: Array(7)}
19: {name: "leftEyeLower2", howManyDots: 9, positions: Array(9)}
20: {name: "leftEyeLower3", howManyDots: 9, positions: Array(9)}
21: {name: "leftEyebrowUpper", howManyDots: 8, positions: Array(8)}
22: {name: "leftEyebrowLower", howManyDots: 6, positions: Array(6)}
23: {name: "midwayBetweenEyes", howManyDots: 1, positions: Array(1)}
24: {name: "noseTip", howManyDots: 1, positions: Array(1)}
25: {name: "noseBottom", howManyDots: 1, positions: Array(1)}
26: {name: "noseRightCorner", howManyDots: 1, positions: Array(1)}
27: {name: "noseLeftCorner", howManyDots: 1, positions: Array(1)}
28: {name: "rightCheek", howManyDots: 1, positions: Array(1)}

*/

/*

  // track places

  model.estimateFaces(videoEl, false, FLIP_CAMERA_REQUIRED).then((faces) => {
    // needsUpdateMesh = true;

    // track the nose

    /*
    `faces` is an array of objects describing each detected face, for example:

    [
      {
        faceInViewConfidence: 1, // The probability of a face being present.
        boundingBox: { // The bounding box surrounding the face.
          topLeft: [232.28, 145.26],
          bottomRight: [449.75, 308.36],
        },
        mesh: [ // The 3D coordinates of each facial landmark.
          [92.07, 119.49, -17.54],
          [91.97, 102.52, -30.54],
          ...
        ],
        scaledMesh: [ // The 3D coordinates of each facial landmark, normalized.
          [322.32, 297.58, -17.54],
          [322.18, 263.95, -30.54]
        ],
        annotations: { // Semantic groupings of the `scaledMesh` coordinates.
          silhouette: [
            [326.19, 124.72, -3.82],
            [351.06, 126.30, -3.00],
            ...
          ],
          ...
        }
      }
    ]

    for (let i = 0; i < faces.length; i++) {
      const annotations = faces[i].annotations;

      let log = [];
      for (let kn in annotations) {
        log.push({
          name: kn,
          howManyDots: annotations[kn].length,
          positions: annotations[kn],
        });
      }

      console.log(log);
    }
  });
*/
