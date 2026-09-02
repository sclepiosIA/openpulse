// Override gl-matrix types to fix TS1540 errors with TS5.5+
// gl-matrix uses 'module' keyword instead of 'namespace' in its type declarations
declare module 'gl-matrix' {
  export const glMatrix: any;
  export const mat2: any;
  export const mat2d: any;
  export const mat3: any;
  export const mat4: any;
  export const quat: any;
  export const quat2: any;
  export const vec2: any;
  export const vec3: any;
  export const vec4: any;
}
