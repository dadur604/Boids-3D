import {defs, tiny} from '../examples/common.js';
const {
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const EPSILON = 0.0000001;

export class CollisionManager {
  constructor(world_shape, world_transform) {
    // Only works for shapes with triangle indicies
    this.world_shape = world_shape
    this.world_transform = world_transform;
  }


  get_collision_vector(origin, direction) {
    let closest_distance = Infinity;
    let output_vector = vec3(0,0,0);
    let output_t = 0;

    // For each triangle
    for (let i = 0; i < this.world_shape.indices.length; i += 3) {
      // Implement Möller–Trumbore_intersection_algorithm
      // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm

      // Extract triangle vertices
      let v0 = this.world_shape.arrays.position[this.world_shape.indices[i+0]];
      let v1 = this.world_shape.arrays.position[this.world_shape.indices[i+1]];
      let v2 = this.world_shape.arrays.position[this.world_shape.indices[i+2]];

      // Transform vertices to world space
      v0 = this.world_transform.times(v0.to4(true)).to3();
      v1 = this.world_transform.times(v1.to4(true)).to3();
      v2 = this.world_transform.times(v2.to4(true)).to3();

      // Get two edges
      let edge1 = v1.minus(v0);
      let edge2 = v2.minus(v0);

      let h = direction.cross(edge2);
      let a = edge1.dot(h);
      if (a > -EPSILON && a < EPSILON) {
        // Ray is parallel to triangle
        continue;
      }

      let f = 1.0 / a;
      let s = origin.minus(v0);
      let u = f * s.dot(h);
      if (u < 0.0 || u > 1.0) {
        // Intersection is outside triangle
        continue;
      }

      let q = s.cross(edge1);
      let v = f * direction.dot(q);
      if (v < 0.0 || u + v > 1.0) {
        // Intersection is outside triangle
        continue;
      }

      // Intersection is inside triangle
      let t = f * edge2.dot(q);
      if (t > EPSILON) {
        // Intersection is in front of ray

        let normal = edge2.cross(edge1).normalized();
        if (normal.dot(direction) > 0) {
          // Intersection is back face of triangle 
          continue;
        }

        if (t < closest_distance) {
          closest_distance = t;
          // return normal of triangle
          output_vector = normal;
          output_t = t;
        }
      } else {
        // Intersection is behind ray
        continue;
      }      
    }

    if (closest_distance === Infinity) {
      return null;
    } else {    
      return {normal: output_vector, t: output_t}
    }
  }
}