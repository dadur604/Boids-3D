import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from "./examples/obj-file-demo.js";
import {Bird} from "./components/bird.js"
import { BirdManager } from './components/bird_manager.js';
import { CollisionManager } from './components/collision_manager.js';
import { BirdModel } from './components/bird_model.js';
import { Terrain_Shader } from './components/terrain_shader.js';
import { Water_Shader } from './components/water_shader.js';
import { Depth_Shader, GROUND_DEPTH_TEX_SIZE, Buffered_Texture } from './components/depth_shader.js';


const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const camera_blending_factor = 0.1;

const polar_to_cart = (theta, phi, r) => ([
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta)
]);


const planet_radius = 140;
const water_radius = 133;
const planet_1_color = hex_color("#aaaaaa");

const b_theta = Math.PI / 2;
const b_phi = 0;
let bird_pos = vec3(...polar_to_cart(b_theta, b_phi, planet_radius + 10));

const num_birds = 100;

const initial_bird_position = vec3(...polar_to_cart(b_theta, b_phi, planet_radius + 10));
const initial_bird_direction = vec3(0,1,0);

const sun_color = hex_color("#ffffff");

// update collisions only ten twenty per second
// and each update, only update `collision_batch_size` birds
const collision_dt = 0.05;
const collision_batch_size = 5;

export class Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            water_sphere: new defs.Subdivision_Sphere(3),
            sphere16: new Shape_From_File("assets/world_smooth.obj"),
            // bird: new Shape_From_File("assets/bird.obj"),
            bird: new BirdModel(),
            cone: new defs.Closed_Cone(4, 4, [[0, 1], [1, 0]])
        };

        // *** Materials
        this.materials = {
            ground_depth_mat: new Material(new Depth_Shader(), {}),
            planet_1: new Material(new Terrain_Shader(),
                {ambient: 0.4, diffusivity: 0.5, specularity: 0.05}),
            // planet_1: new Material(new Depth_Shader()),
            water: new Material(new Water_Shader(),
                {ambient: 0.5, diffusivity: .4, specular: .8, color: hex_color("#3333ff", 0.8), ground_depth_texture: null})         
        }

        this.bird_manager = new BirdManager()
        this.collision_manager = new CollisionManager(this.shapes.sphere16, Mat4.scale(120,120,120,))

        this.player_bird = new Bird(
            this.bird_manager,
            this.collision_manager,
            initial_bird_position,
            initial_bird_direction,
            this.shapes.bird,
            this.materials.planet_1.override({color: hex_color("#2222ff")}),
            this.shapes.cone
        )

        this.other_birds = [...new Array(num_birds)].map(() => new Bird(
            this.bird_manager,
            this.collision_manager,
            vec3(...polar_to_cart(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 100 + planet_radius)),
            // initial_bird_position.copy(),
            vec3(0,0,0).randomized(1),
            // initial_bird_direction.copy(),
            this.shapes.bird,
            this.materials.planet_1.override({color: hex_color("#22ff22")}),
            this.shapes.cone
        ));

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));

        this.control_x_l = 0;
        this.control_x_r = 0;
        this.control_y_u = 0;
        this.control_y_d = 0;

        this.view_globe = false;

        this.last_collision_time = 0;
        this.last_collision_batch_idx = 0;
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Turn Left", ["a"], () => this.control_x_l = 1, undefined, () => this.control_x_l = 0);
        this.key_triggered_button("Turn Right", ["d"], () => this.control_x_r = 1, undefined, () => this.control_x_r = 0);
        
        this.key_triggered_button("Pitch Up", ["s"], () => this.control_y_u = 1, undefined, () => this.control_y_u = 0);
        this.key_triggered_button("Pitch Down", ["w"], () => this.control_y_d = 1, undefined, () => this.control_y_d = 0);

        this.key_triggered_button("View Globe", ["r"], () => this.view_globe = !this.view_globe);
    }

    // Sourced from 2-pass shadow example, modified
    texture_buffer_init(gl) {
        // Depth Texture
        this.groundDepthTexture = gl.createTexture();
        // Bind it to TinyGraphics
        this.ground_depth_texture = new Buffered_Texture(this.groundDepthTexture);
        this.materials.water.ground_depth_texture = this.ground_depth_texture
        this.groundDepthTextureSize = GROUND_DEPTH_TEX_SIZE;

        // Depth Texture Buffer
        this.groundDepthFramebuffer = gl.createFramebuffer();

        // create a color texture of the same size as the depth texture
        gl.bindTexture(gl.TEXTURE_2D, this.groundDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.groundDepthTextureSize,
            this.groundDepthTextureSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // attach it to the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.groundDepthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,        // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,         // texture target
            this.groundDepthTexture,// texture
            0);                    // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    display(context, program_state) {
        const gl = context.context;
        if (!this.init_ok) {
            this.texture_buffer_init(gl);
            this.init_ok = true;
        }

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000 || 1/60.;
        this.materials.water.replace({time: t})

        // ====Lighting====

        const light_position = vec4(1000, 1000, 1000, 1);
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, sun_color, 100000000)];

        // ====Planets====

        // FIRST dray our world to the ground depth buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.groundDepthFramebuffer);
        gl.viewport(0, 0, this.groundDepthTextureSize, this.groundDepthTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const ground_view_mat = Mat4.look_at(this.player_bird.position.normalized().times(planet_radius * 4), vec3(0,0,0), this.player_bird.direction);
        const ground_proj_mat = Mat4.perspective(Math.PI / 4, 1, 0.5, 500);
        program_state.ground_view_mat = ground_view_mat;
        program_state.ground_proj_mat = ground_proj_mat;
        program_state.ground_tex_mat = ground_proj_mat;
        program_state.view_mat = ground_view_mat;
        program_state.projection_transform = ground_proj_mat;

        const planet_transform = Mat4.scale(120,120,120);
        this.shapes.sphere16.draw(context, program_state, planet_transform, this.materials.ground_depth_mat)

        // THEN draw rest of scene as normal

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // ====Camera====
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        if (this.view_globe) {
            program_state.set_camera(Mat4.look_at(this.player_bird.position.normalized().times(planet_radius * 4), vec3(0,0,0), this.player_bird.direction))
        } else {
            program_state.set_camera(Mat4.look_at(
                this.player_bird.position.plus(this.player_bird.position.normalized().times(20).plus(this.player_bird.direction.normalized().times(-20))),
                this.player_bird.position,
                this.player_bird.direction));
        }
        // ===========

        this.shapes.sphere16.draw(context, program_state, planet_transform, this.materials.planet_1)
        const water_transform = Mat4.scale(water_radius,water_radius,water_radius);
        this.shapes.water_sphere.draw(context, program_state, water_transform, this.materials.water)

        // ====Bird====

        const turn_x = this.control_x_l * -1 + this.control_x_r * 1;
        const turn_y = this.control_y_u * 1 + this.control_y_d * -1;
        this.player_bird.update(dt, {turn_x, turn_y});
        for (const bird of this.other_birds) {
            bird.update(dt);
        }

        // Collisions
        if (t - this.last_collision_time > collision_dt) {
            this.last_collision_time = t;

            this.player_bird.calculateCollision();
            for (let i = this.last_collision_batch_idx; i < this.last_collision_batch_idx + collision_batch_size; i++) {
                if (i >= this.other_birds.length) continue;
                this.other_birds[i].calculateCollision();
            }

            this.last_collision_batch_idx += collision_batch_size;
            if (this.last_collision_batch_idx >= this.other_birds.length) this.last_collision_batch_idx = 0;
        }

        this.player_bird.draw(context, program_state);
        for (const bird of this.other_birds) {
            bird.draw(context, program_state);
        }


        
        // ==============
    }
}

