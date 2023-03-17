import {defs, tiny} from '../examples/common.js';
import {Shape_From_File} from "../examples/obj-file-demo.js";
import { FOG_FAR, FOG_NEAR, FOG_COLOR } from '../project.js';

const {
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;


export class BirdModel {
  constructor() {
  
    this.body = new Shape_From_File("../assets/bird/body.obj");
    this.wingr = new Shape_From_File("../assets/bird/wingr.obj");
    this.wingl = new Shape_From_File("../assets/bird/wingl.obj");
    this.tail = new Shape_From_File("../assets/bird/tail.obj");

    this.material = new Material(new defs.Textured_Phong(), {
      color: hex_color("#000000"),
      ambient: 0.5, diffusivity: 0.5, specularity: 0.1,
      texture: new Texture("../assets/texture.png", "LINEAR"),
      fogFar: FOG_FAR, fogNear: FOG_NEAR, fogColor: FOG_COLOR
    });

  }

  draw(context, program_state, model_transform, {rand_uid, wing_angle_stop_t, wing_angle_double_t, is_unique}) {
    const t = program_state.animation_time / 1000;

    let body_transform = Mat4.identity();

    let x,y = 0;
    if (is_unique) {
      let j = rand_uid * 36;
      if (j < 36) {
        x = Math.floor(j / 6);
        y = Math.floor(j % 6);
      }
    }
    
    let material = this.material.override({tex_offset: vec(x/6,y/6)})
    this.body.draw(context, program_state, body_transform.pre_multiply(model_transform), material);

    let wing_angle = Math.cos((t + rand_uid)*5) * 0.2 + 0.1;
    let wing_angle_double = Math.cos((t + rand_uid)*15) * 0.3;
    wing_angle = wing_angle * (1-wing_angle_stop_t) + (wing_angle_stop_t) * -0.2;
    wing_angle = wing_angle * (1-wing_angle_double_t) + (wing_angle_double_t) * wing_angle_double;

    let wingr_transform = Mat4.rotation(wing_angle, 0, 1, 0);
    wingr_transform = wingr_transform.post_multiply(Mat4.translation(2,-1.5,-0.2))
    this.wingr.draw(context, program_state, wingr_transform.pre_multiply(model_transform), material);
  
    let wingl_transform = Mat4.rotation(-wing_angle, 0, 1, 0);
    wingl_transform = wingl_transform.post_multiply(Mat4.translation(-2,-1.5,-0.2));
    this.wingl.draw(context, program_state, wingl_transform.pre_multiply(model_transform), material);
    
    let tail_transform = Mat4.translation(0,-4.2,-0.4);
    this.tail.draw(context, program_state, tail_transform.pre_multiply(model_transform), material);
  }
}