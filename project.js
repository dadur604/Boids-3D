import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from "./examples/obj-file-demo.js";
import {Bird} from "./components/bird.js"
import { BirdManager } from './components/bird_manager.js';
import { CollisionManager } from './components/collision_manager.js';
import { BirdModel } from './components/bird_model.js';


const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const camera_blending_factor = 0.1;

const polar_to_cart = (theta, phi, r) => ([
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta)
]);


const planet_radius = 120;
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
const collision_batch_size = 10;

export class Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            sphere16: new defs.Subdivision_Sphere(4),
            // bird: new Shape_From_File("assets/bird.obj"),
            bird: new BirdModel(),
            cone: new defs.Closed_Cone(4, 4, [[0, 1], [1, 0]])
        };

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(1,0.1,0.1).pre_multiply(Mat4.translation(1,0,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(0.2,0.2,0.2).pre_multiply(Mat4.translation(0.5,0.5,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(0.1,1,0.2).pre_multiply(Mat4.translation(0,1,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(1,1,0.2).pre_multiply(Mat4.translation(0.5,0.6,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(1,0.1,0.1).pre_multiply(Mat4.translation(-1,0,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(0.2,0.2,0.2).pre_multiply(Mat4.translation(-0.5,0.5,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(0.1,1,0.2).pre_multiply(Mat4.translation(0,-1,0)))

        defs.Closed_Cone.insert_transformed_copy_into(this.shapes.sphere16, 
            [4, 4, [[0, 1], [1, 0]]], Mat4.scale(1,1,0.2).pre_multiply(Mat4.translation(0.5,-0.6,0)))

        // *** Materials
        this.materials = {
            planet_1: new Material(new defs.Phong_Shader(),
                {ambient: 0.5, diffusivity: .5, color: planet_1_color})           
        }

        this.bird_manager = new BirdManager()
        this.collision_manager = new CollisionManager(this.shapes.sphere16, Mat4.scale(planet_radius,planet_radius,planet_radius))

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

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000 || 1/60.;

        // ====Lighting====

        const light_position = vec4(1000, 1000, 1000, 1);
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, sun_color, 100000000)];

        // ====Planets====

        const planet_transform = Mat4.scale(planet_radius,planet_radius,planet_radius);
        this.shapes.sphere16.draw(context, program_state, planet_transform, this.materials.planet_1)

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

        // ====Camera====
        
        if (this.view_globe) {
            program_state.set_camera(Mat4.look_at(this.player_bird.position.normalized().times(planet_radius * 4), vec3(0,0,0), this.player_bird.direction))
        } else {
            program_state.set_camera(Mat4.look_at(
                this.player_bird.position.plus(this.player_bird.position.normalized().times(20).plus(this.player_bird.direction.normalized().times(-20))),
                this.player_bird.position,
                this.player_bird.direction));
        }
        
        // ==============
    }
}

