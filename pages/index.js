import React, { useEffect, useRef, useState } from "react";
import { ENRuntime, getEffectNodeData } from "effectnode";

import { Canvas, useFrame } from "@react-three/fiber";
import { getCodes, firebaseConfig } from "../vfx";
import { GraphEditorPage } from "effectnode-cms";

/* graphTitle: loklok */
/* graphID: -MfyYdM7swln7PVk3_rp */
let graphID = `-MfyYdM7swln7PVk3_rp`;

export function FirebaseDemo() {
  //

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas style={{ width: "100%", height: "60%" }}>
        <EffectNodeInFiber />
      </Canvas>
      <div style={{ height: "40%", width: "100%" }}>
        <GraphEditorPage
          firebaseConfig={firebaseConfig}
          canvasID={graphID}
          ownerID={`NGpUixuU0NOkOlmLsLuepkaZxxt1`}
          codes={getCodes()}
        />
      </div>
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

  useEffect(() => {
    getEffectNodeData({ firebaseConfig, graphID: graphID }).then((json) => {
      graph.current = new ENRuntime({
        json: json,
        codes: getCodes(),
      });

      graph.current.mini.get("DefaultComponent").then((v) => {
        setCompos(v);
      });
    });

    return () => {
      if (graph.current) {
        graph.current.mini.clean();
        graph.current.clean();
      }
    };
  }, []);

  useEffect(() => {
    let fn = () => {
      if (graph.current) {
        graph.current.mini.clean();
        graph.current.clean();
      }

      getEffectNodeData({
        firebaseConfig,
        graphID: graphID,
      }).then((json) => {
        graph.current = new ENRuntime({
          json: json,
          codes: getCodes(),
        });
      });
    };
    window.addEventListener("change-graph", fn);
    return () => {
      window.removeEventListener("change-graph", fn);
    };
  }, []);

  useFrame(({ get }) => {
    let three = get();
    if (graph.current) {
      for (let kn in three) {
        graph.current.mini.set(kn, three[kn]);
      }
      if (mounter.current) {
        graph.current.mini.set("mounter", mounter.current);
      }
      graph.current.mini.work();
    }
  });

  return (
    <group>
      <group ref={mounter}>{myInst}</group>
    </group>
  );
}
