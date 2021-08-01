import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export function effect({ mini, node }) {
  node.in0.stream((v) => {
    console.log(v)
  })

  mini.set('DefaultComponent', <MyCustomComponent></MyCustomComponent>)
}

function MyCustomComponent() {
  let ref = useRef()
  useFrame((st, dt) => {
    if (ref.current) {
      ref.current.rotation.x += dt * 0.5
    }
  })

  return (
    <group>
      <mesh ref={ref}>
        <boxBufferGeometry args={[3, 3, 3, 2, 2, 2]}></boxBufferGeometry>
        <meshBasicMaterial color={'blue'} wireframe={true}></meshBasicMaterial>
      </mesh>
    </group>
  )
}
