import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from "./examples/obj-file-demo.js";

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const camera_blending_factor = 0.1;

const polar_to_cart = (theta, phi, r) => ([
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta)
]);


const planet_radius = 50;
const planet_1_color = hex_color("#aaaaaa");

const b_theta = Math.PI / 2;
const b_phi = 0;
let bird_velocity = vec3(0,1,0);
const gravity = 0.0015;
let bird_pos = vec3(...polar_to_cart(b_theta, b_phi, planet_radius + 10));
const bird_speed = 20;

const sun_color = hex_color("#ffffff");

export class Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            sphere16: new defs.Subdivision_Sphere(4),
            bird: new Shape_From_File("assets/bird.obj")
        };

        // *** Materials
        this.materials = {
            planet_1: new Material(new defs.Phong_Shader(),
                {ambient: 0.5, diffusivity: .5, color: planet_1_color})           
        }


        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));

        this.control_x = 0;
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Turn Right", ["d"], () => this.control_x += 1, undefined, () => this.control_x -= 0);
        this.key_triggered_button("Turn Left", ["a"], () => this.control_x -= 1, undefined, () => this.control_x += 0);
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
        
        const gravity_vector = bird_pos.times(-1).normalized();

        bird_velocity.add_by(gravity_vector.cross(bird_velocity).normalized().times(this.control_x).times(0.1).times(dt))

        bird_velocity.add_by(gravity_vector.times(gravity));
        bird_velocity.normalize();
        bird_velocity.scale_by(bird_speed);
        bird_velocity.scale_by(dt);

        bird_pos = bird_pos.plus(bird_velocity)

        let bird_transform = Mat4.rotation(- Math.PI, 0,1,0);
        // let bird_transform = Mat4.identity();
        bird_transform.pre_multiply(Mat4.inverse(Mat4.look_at(vec3(0,0,0), bird_velocity, vec3(0,1,0))));
        bird_transform.pre_multiply(Mat4.translation(...bird_pos));
        this.shapes.bird.draw(context, program_state, bird_transform, this.materials.planet_1.override({color: hex_color("#2222ff")}));

        // ====Camera====
        
        program_state.set_camera(Mat4.look_at(
            bird_pos.plus(bird_pos.normalized().times(20).plus(bird_velocity.normalized().times(-5))),
            bird_pos,
            bird_velocity));
        // ==============
    }
}


