import * as THREE from 'three'

export function fiberMaterial(opacity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uEnergy: { value: 1 }, uOpacity: { value: opacity } },
    vertexShader: `attribute float aAlong; attribute float aPhase; varying float vAlong; varying float vPhase;
      void main(){vAlong=aAlong;vPhase=aPhase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float uTime; uniform float uEnergy; uniform float uOpacity; varying float vAlong; varying float vPhase;
      void main(){float head=fract(uTime*(.11+vPhase*.09)+vPhase);float d=abs(vAlong-head);float packet=exp(-d*d*2100.0);float flicker=.84+.16*sin(uTime*1.3+vPhase*31.0);
      vec3 color=mix(vec3(.035,.24,.47),vec3(.44,.81,1.0),packet);float alpha=(.12+packet*.58)*uEnergy*uOpacity*flicker;
      gl_FragColor=vec4(color*(.8+packet*1.8),alpha);
      #include <colorspace_fragment>
      }`,
  })
}
export function neuronMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 700 }, uEnergy: { value: 1 } },
    vertexShader: `attribute float aSize;attribute float aPower;attribute float aPhase;attribute vec3 aColor;uniform float uScale;uniform float uTime;varying vec3 vColor;varying float vPower;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*uScale/max(.1,-p.z),1.5,90.0);vColor=aColor;vPower=aPower*(.85+.15*sin(uTime*1.8+aPhase));}`,
    fragmentShader: `uniform float uEnergy;varying vec3 vColor;varying float vPower;
      void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv);if(r>.5)discard;float core=exp(-r*r*330.0);float halo=exp(-r*r*24.0)*.34;float cross=(exp(-abs(uv.x)*90.0-abs(uv.y)*8.0)+exp(-abs(uv.y)*90.0-abs(uv.x)*8.0))*.13*step(1.7,vPower);
      float alpha=(core+halo+cross)*vPower*uEnergy;vec3 color=mix(vColor,vec3(.83,.95,1.0),core*.85)*(1.0+core*vPower*.45);gl_FragColor=vec4(color,alpha);
      #include <colorspace_fragment>
      }`,
  })
}
