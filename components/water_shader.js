import {tiny} from '../tiny-graphics.js';
import { GROUND_DEPTH_TEX_SIZE } from './depth_shader.js';
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4,
    Light, Shape, Material, Shader, Texture, Scene, hex_color
} = tiny;

export const Water_Shader = class Water_Shader extends Shader {
  // Terrain Shader acts just like a phong shader, but has waves and translucency like water

  constructor(num_lights = 2) {
    super();
    this.num_lights = num_lights;
  }

  shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return (
      ` precision mediump float;
                const int N_LIGHTS = ` +
      this.num_lights +
      `;
                uniform float ambient, diffusivity, specularity, smoothness;
                uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
                uniform float light_attenuation_factors[N_LIGHTS];
                uniform vec3 squared_scale, camera_center;
                uniform vec4 color;
                uniform float ground_texture_size;
                uniform sampler2D ground_depth_texture;
                uniform mat4 ground_view_mat;
                uniform mat4 ground_proj_mat;
                uniform float time;
                varying float whiteness;
        
                // Specifier "varying" means a variable's final value will be passed from the vertex shader
                // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
                // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
                varying vec3 N, vertex_worldspace;
                // ***** PHONG SHADING HAPPENS HERE: *****                                       
                vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){       
                    // phong_model_lights():  Add up the lights' contributions.
                    vec3 E = normalize( camera_center - vertex_worldspace );
                    vec3 result = vec3( 0.0 );
                    for(int i = 0; i < N_LIGHTS; i++){
                        // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                        // light will appear directional (uniform direction from all points), and we 
                        // simply obtain a vector towards the light by directly using the stored value.
                        // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                        // the point light's location from the current surface point.  In either case, 
                        // fade (attenuate) the light as the vector needed to reach it gets longer.  
                        vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                                       light_positions_or_vectors[i].w * vertex_worldspace;                                             
                        float distance_to_light = length( surface_to_light_vector );
        
                        vec3 L = normalize( surface_to_light_vector );
                        vec3 H = normalize( L + E );
                        // Compute the diffuse and specular components from the Phong
                        // Reflection Model, using Blinn's "halfway vector" method:
                        float diffuse  =      max( dot( N, L ), 0.0 );
                        float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                        float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                        
                        vec3 light_contribution = color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                                  + light_colors[i].xyz * specularity * specular;
                        result += attenuation * light_contribution;
                      }
                    return result;
                  } `
    );
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    return (
      this.shared_glsl_code() +
      `
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
                
        
                void main(){     
                    // The vertex's final resting place (in NDCS):
                    float rand_height = (
                      cos(time + position.x * 10.0) *
                      sin(time + position.y * 10.0) *
                      cos(time + position.z * 10.0));

                    whiteness = smoothstep(0.2,0.4,rand_height);
                    rand_height *= 0.02;
                    
                    vec3 position_offset = normalize(position) * rand_height;
                    gl_Position = projection_camera_model_transform * vec4( position + position_offset, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                  } `
    );
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    // A fragment is a pixel that's overlapped by the current triangle.
    // Fragments affect the final image or get discarded due to depth.
    return (
      this.shared_glsl_code() +
      `     
                void main(){       
                    vec4 ground_tex_coord = (ground_proj_mat * ground_view_mat * vec4(vertex_worldspace, 1.0));
                    // convert NDCS from ground's POV to ground depth texture coordinates
                    ground_tex_coord.xyz /= ground_tex_coord.w; 
                    ground_tex_coord.xyz *= 0.5;
                    ground_tex_coord.xyz += 0.5;
                    float ground_depth = texture2D(ground_depth_texture, ground_tex_coord.xy).x;
                    ground_depth = smoothstep(0.0,0.6,ground_depth);
                        
                    // Compute an initial (ambient) color:
                    gl_FragColor = vec4( color.xyz * ambient, color.w );
                    // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );

                    // gl_FragColor.xyz += whiteness * cos(whiteness * 10.0 - time + 10.0) * vec3(0.2,0.2,0.2);

                    // in deep ocean, add more dark blue
                    float deep_ocean_t = smoothstep(0.0,0.03,ground_depth);
                      gl_FragColor.xyz -= (1.0-deep_ocean_t) * vec3(0.1,0.1,0.1);

                    gl_FragColor.xyz += ground_depth * (max(0.0,cos(ground_depth * 50.0 - time + 30.0)) + 0.1) * vec3(0.5,0.5,0.5);
                  } `
    );
  }

  send_material(gl, gpu, material) {
    // send_material(): Send the desired shape-wide material qualities to the
    // graphics card, where they will tweak the Phong lighting formula.
    gl.uniform4fv(gpu.color, material.color);
    gl.uniform1f(gpu.ambient, material.ambient);
    gl.uniform1f(gpu.diffusivity, material.diffusivity);
    gl.uniform1f(gpu.specularity, material.specularity);
    gl.uniform1f(gpu.smoothness, material.smoothness);
    gl.uniform1f(gpu.time, material.time);
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    // send_gpu_state():  Send the state of our whole drawing context to the GPU.
    const O = vec4(0, 0, 0, 1),
      camera_center = gpu_state.camera_transform.times(O).to3();
    gl.uniform3fv(gpu.camera_center, camera_center);
    // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
    const squared_scale = model_transform
      .reduce((acc, r) => {
        return acc.plus(vec4(...r).times_pairwise(r));
      }, vec4(0, 0, 0, 0))
      .to3();
    gl.uniform3fv(gpu.squared_scale, squared_scale);
    // Send the current matrices to the shader.  Go ahead and pre-compute
    // the products we'll need of the of the three special matrices and just
    // cache and send those.  They will be the same throughout this draw
    // call, and thus across each instance of the vertex shader.
    // Transpose them since the GPU expects matrices as column-major arrays.
    const PCM = gpu_state.projection_transform
      .times(gpu_state.camera_inverse)
      .times(model_transform);
    gl.uniformMatrix4fv(
      gpu.model_transform,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.projection_camera_model_transform,
      false,
      Matrix.flatten_2D_to_1D(PCM.transposed())
    );

    // Omitting lights will show only the material color, scaled by the ambient term:
    if (!gpu_state.lights.length) return;

    const light_positions_flattened = [],
      light_colors_flattened = [];
    for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
      light_positions_flattened.push(
        gpu_state.lights[Math.floor(i / 4)].position[i % 4]
      );
      light_colors_flattened.push(
        gpu_state.lights[Math.floor(i / 4)].color[i % 4]
      );
    }
    gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
    gl.uniform4fv(gpu.light_colors, light_colors_flattened);
    gl.uniform1fv(
      gpu.light_attenuation_factors,
      gpu_state.lights.map((l) => l.attenuation)
    );

    gl.uniformMatrix4fv(gpu.ground_view_mat, false, Matrix.flatten_2D_to_1D(gpu_state.ground_view_mat.transposed()));
    gl.uniformMatrix4fv(gpu.ground_proj_mat, false, Matrix.flatten_2D_to_1D(gpu_state.ground_proj_mat.transposed()));
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {

    const defaults = {
      color: hex_color("#0000ff"),
      ambient: 0,
      diffusivity: 1,
      specularity: 1,
      smoothness: 40,
      time: 0
    };
    material = Object.assign({}, defaults, material);

    context.uniform1f(gpu_addresses.ground_texture_size, GROUND_DEPTH_TEX_SIZE);
    context.uniform1i(gpu_addresses.ground_depth_texture, 0); 
    if (material.ground_depth_texture && material.ground_depth_texture.ready) {
        context.activeTexture(context["TEXTURE" + 0]);
        material.ground_depth_texture.activate(context, 0);
    }

    this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
};
