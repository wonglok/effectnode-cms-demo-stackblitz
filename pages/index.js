import React, { useEffect, useRef, useState } from "react";
import { ENRuntime, getEffectNodeData } from "effectnode";

import { Canvas, useFrame } from "@react-three/fiber";
import { getCodes, firebaseConfig } from "../vfx";
import { GraphEditorPage } from "effectnode-cms";

//123

/* graphTitle: loklok */
/* graphID: -MfyYdM7swln7PVk3_rp */
/* ownerID: NGpUixuU0NOkOlmLsLuepkaZxxt1 */
let graphID = `-MfyYdM7swln7PVk3_rp`;
let ownerID = `NGpUixuU0NOkOlmLsLuepkaZxxt1`;

// visit
// http://localhost:3000/cms

export function FirebaseDemo() {
  useEffect(() => {
    let setH100 = (q) => {
      try {
        let dom = document.querySelector(q);
        if (dom) {
          dom.style.height = "100%";
        }
      } catch (e) {
        console.log(e);
      }
    };
    setH100("html");
    setH100("body");
    setH100("#root");
    setH100("#__next");
  }, []);
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas style={{ width: "100%", height: "60%" }}>
        <EffectNodeInFiber />
      </Canvas>
      <div style={{ height: "40%", width: "100%" }}>
        <GraphEditorPage
          firebaseConfig={firebaseConfig}
          canvasID={graphID}
          ownerID={ownerID}
          codes={getCodes()}
        />
      </div>
      <a
        style={{
          display: "inline-block",
          position: "absolute",
          bottom: "10px",
          right: "10px",
          backgroundColor: "blue",
          padding: "15px 20px",
          color: "white",
          borderRadius: "20px",
          fontSize: "20px",
          lineHeight: "20px",
        }}
        target="_blank"
        href="/cms"
      >
        /cms
      </a>
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
    let onChangeGraph = () => {
      if (graph.current) {
        setCompos(null);
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

        graph.current.mini.get("DefaultComponent").then((v) => {
          setCompos(v);
        });
      });
    };

    window.addEventListener("change-graph", onChangeGraph);
    return () => {
      window.removeEventListener("change-graph", onChangeGraph);
    };
  }, []);

  useEffect(() => {
    // init signal
    window.dispatchEvent(new window.CustomEvent("change-graph"));

    return () => {
      // cleanup on unmount
      if (graph.current) {
        setCompos(null);
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
