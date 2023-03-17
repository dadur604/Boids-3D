import {tiny} from '../tiny-graphics.js';
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4,
    Light, Shape, Material, Shader, Texture, Scene, hex_color
} = tiny;

export const GROUND_DEPTH_TEX_SIZE = 2048;


export const Depth_Shader = class Depth_Shader extends Shader {
  // Terrain Shader acts just like a phong shader, but has waves and translucency like water

  vertex_glsl_code() {
    return (
      `
      precision mediump float;
      attribute vec3 position, normal;                            
      
      uniform mat4 model_transform;
      uniform mat4 projection_camera_model_transform;

      uniform mat4 ground_view_mat;
      uniform mat4 ground_proj_mat;
      uniform float time;

      varying vec3 vertex_worldspace;

      void main(){     
          gl_Position = ground_proj_mat * ground_view_mat * model_transform * vec4( position, 1.0 );
          vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
        }`
    );
  }

  fragment_glsl_code() {
    return (
      `
      precision mediump float;
      varying vec3 vertex_worldspace;
      
      void main(){          
        float height = length(vertex_worldspace);
        height = smoothstep(100.0,200.0,height);                                                 
        gl_FragColor = vec4(height,height,height,1.0); 
      }`
    );
  }

  send_material(gl, gpu, material) {
    // send_material(): Send the desired shape-wide material qualities to the
    // graphics card, where they will tweak the Phong lighting formula.
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

    gl.uniformMatrix4fv(gpu.ground_view_mat, false, Matrix.flatten_2D_to_1D(gpu_state.ground_view_mat.transposed()));
    gl.uniformMatrix4fv(gpu.ground_proj_mat, false, Matrix.flatten_2D_to_1D(gpu_state.ground_proj_mat.transposed()));
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
    // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
    // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
    // program (which we call the "Program_State").  Send both a material and a program state to the shaders
    // within this function, one data field at a time, to fully initialize the shader for a draw.

    // Fill in any missing fields in the Material object with custom defaults for this shader:
    const defaults = {

    };
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
};

// Sourced from https://github.com/Robert-Lu/tiny-graphics-shadow_demo/blob/master/examples/shadow-demo-shaders.js
export class Buffered_Texture extends tiny.Graphics_Card_Object {
  constructor(texture_buffer_pointer) {
      super();
      Object.assign(this, {texture_buffer_pointer});
      this.ready = true;
      this.texture_buffer_pointer = texture_buffer_pointer;
  }

  copy_onto_graphics_card(context, need_initial_settings = true) {
      const initial_gpu_representation = {texture_buffer_pointer: undefined};
      const gpu_instance = super.copy_onto_graphics_card(context, initial_gpu_representation);

      if (!gpu_instance.texture_buffer_pointer) gpu_instance.texture_buffer_pointer = this.texture_buffer_pointer;

      return gpu_instance;
  }

  activate(context, texture_unit = 0) {
      if (!this.ready)
          return;
      const gpu_instance = super.activate(context);
      context.activeTexture(context["TEXTURE" + texture_unit]);
      context.bindTexture(context.TEXTURE_2D, this.texture_buffer_pointer);
  }
}