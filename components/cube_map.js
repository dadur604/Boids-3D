import {tiny} from '../tiny-graphics.js';
const {
    Graphics_Card_Object, Mat4, Shader, Matrix
} = tiny;

export const CubeMapTexture =
class CubeMapTexture extends Graphics_Card_Object {
    // Cube Map Texture:  A texture that wraps around a cube, with one image per side.
    // urls: string[] pass in order: +x, -x, +y, -y, +z, -z
    // Reference: https://webglfundamentals.org/webgl/lessons/webgl-skybox.html
    constructor(urls, min_filter = "LINEAR_MIPMAP_LINEAR") {
        super();

        Object.assign(this, {urls, min_filter});

        // Create html image objects to load urls
        this.ready_num = 0;
        this.ready = false;

        this.images = urls.map(url => {
            const image = new Image();
            image.crossOrigin = "Anonymous";           // Avoid a browser warning.
            image.src = url;
            image.addEventListener('load', () => {
                if (++this.ready_num === 6) this.ready = true;
            });
            return image;
        });
    }

    copy_onto_graphics_card(context, need_initial_settings = true) {
        // copy_onto_graphics_card():  Called automatically as needed to load the
        // texture image onto one of your GPU contexts for its first time.

        // Define what this object should store in each new WebGL Context:
        const initial_gpu_representation = {texture_buffer_pointer: undefined};
        // Our object might need to register to multiple GPU contexts in the case of
        // multiple drawing areas.  If this is a new GPU context for this object,
        // copy the object to the GPU.  Otherwise, this object already has been
        // copied over, so get a pointer to the existing instance.
        const gpu_instance = super.copy_onto_graphics_card(context, initial_gpu_representation);

        console.log("Copy onto graphics card...", gpu_instance)

        if (!gpu_instance.texture_buffer_pointer) gpu_instance.texture_buffer_pointer = context.createTexture();

        const gl = context;
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, gpu_instance.texture_buffer_pointer);

        if (need_initial_settings) {
            // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            // Always use bi-linear sampling when zoomed out.
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl[this.min_filter]);
            // Let the user to set the sampling method
            // when zoomed in.
        }

        // Copy each image into the texture buffer.
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[0]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[1]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[2]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[3]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[4]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[5]);

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, gpu_instance.texture_buffer_pointer);


        console.log("Called texImage2D", gpu_instance)

        if (this.min_filter == "LINEAR_MIPMAP_LINEAR")
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        // If the user picked tri-linear sampling (the default) then generate
        // the necessary "mips" of the texture and store them on the GPU with it.
        return gpu_instance;
    }

    activate(context, texture_unit = 0) {
        // activate(): Selects this Texture in GPU memory so the next shape draws using it.
        // Optionally select a texture unit in case you're using a shader with many samplers.

        // Terminate draw requests until all 6 images are loaded.

        if (!this.ready)
            return;

        const gpu_instance = super.activate(context);
        context.activeTexture(context["TEXTURE" + texture_unit]);
        context.bindTexture(context.TEXTURE_CUBE_MAP, gpu_instance.texture_buffer_pointer);
    }
}

export const CubeMapShader =
class CubeMapShader extends Shader {
  update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
      // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
      const [P, C] = [graphics_state.projection_transform, graphics_state.camera_inverse];
      const PC = P.times(C);
      const projection_camera_inverse_transform = Mat4.inverse(PC);
      context.uniformMatrix4fv(gpu_addresses.projection_camera_inverse_transform, false,
          Matrix.flatten_2D_to_1D(projection_camera_inverse_transform.transposed()));

      if (material.texture && material.texture.ready) {
        // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
        context.uniform1i(gpu_addresses.skybox, 0);
        // For this draw, use the texture image from correct the GPU buffer:
        material.texture.activate(context);
      }
  }

  vertex_glsl_code() {
      return `
      precision mediump float;

      attribute vec2 position;
      varying vec2 v_position;

      void main() {
        v_position = position;
        gl_Position = vec4(position, 1, 1.0);
      }`;
  }

  fragment_glsl_code() {
      return `
      precision mediump float;

      uniform samplerCube skybox;
      uniform mat4 projection_camera_inverse_transform;
      varying vec2 v_position;

      void main() {
        vec4 t = projection_camera_inverse_transform * vec4(v_position, 1.0, 1.0);
        gl_FragColor = textureCube(skybox, normalize(t.xyz / t.w));

        // gl_FragColor = vec4(1,1,1,1);
      }`;
  }
}