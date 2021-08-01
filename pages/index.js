import React, { useEffect, useRef, useState } from 'react';
import { ENRuntime, getEffectNodeData } from 'effectnode';
import { Canvas, useFrame } from '@react-three/fiber';
import { getCodes, firebaseConfig } from '../vfx';

export function FirebaseDemo() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas style={{ width: '100%', height: '50%' }}>
        <EffectNodeInFiber />
      </Canvas>
      <iframe style={{ height: '50%', width: '100%' }} src={'/cms'} />
    </div>
  );
}

export default FirebaseDemo;

export function EffectNodeInFiber() {
  let mounter = useRef();
  let graph = useRef();
  let [myInst, setCompos] = useState(() => {
    return <group />;
  });

  /* graphTitle: loklok */
  /* graphID: -MfyYdM7swln7PVk3_rp */
  useEffect(() => {
    getEffectNodeData({ firebaseConfig, graphID: `-MfyYdM7swln7PVk3_rp` }).then(
      json => {
        graph.current = new ENRuntime({
          json: json,
          codes: getCodes()
        });

        graph.current.mini.get('DefaultComponent').then(v => {
          setCompos(v);
        });
      }
    );

    return () => {
      if (graph.current) {
        graph.current.mini.clean();
        graph.current.clean();
      }
    };
  }, []);

  useFrame(({ get }) => {
    let three = get();
    if (graph.current) {
      for (let kn in three) {
        graph.current.mini.set(kn, three[kn]);
      }
      if (mounter.current) {
        graph.current.mini.set('mounter', mounter.current);
      }
      graph.current.mini.work();
    }
  });

  return <group ref={mounter}>{myInst}</group>;
}

//
