import {defs, tiny} from '../examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const bird_speed = 20;
const max_roll_angle = 0.3;
const roll_speed_coefficient = 0.02

export class Bird {
  position = vec3();
  direction = vec3();


  constructor(position, direction, shape, material) {
    this.position = position
    this.direction = direction;

    this.shape = shape;
    this.material = material;

    this.angle = 0;
  }

  // turn_x -1 or +1 if turning left or right. Undefined if not player-controller
  update(dt, turn_x = 0) {
    const gravity_vector = this.position.times(-1).normalized();
    const current_height = this.position.norm();

    // Set velocity to dir * speed * dt
    let velocity = this.direction.normalized();
    velocity.scale_by(bird_speed);
    velocity.scale_by(dt);

    // Add velocity to position
    const new_position = this.position.plus(velocity)

    // Clamp to current height around globe
    this.position = new_position.normalized().times(current_height);

    // Set rotation and velocity to match around globe
    const fromDirection = velocity.cross(gravity_vector.cross(velocity));
    const toDirection = gravity_vector;
    const axis = fromDirection.cross(toDirection);
    let angleRadians = Math.acos(fromDirection.normalized().dot(toDirection.normalized()));

    // First turn bird according to turn_x
    velocity = Mat4.rotation(turn_x * 0.1 * dt, gravity_vector[0], gravity_vector[1], gravity_vector[2]).times(velocity.to4(false)).to3();
    
    // Then turn bird according to sphere
    if (!isNaN(angleRadians)) {
        while (angleRadians > (Math.PI / 2)) {
            angleRadians -= (Math.PI)
        }
        velocity = Mat4.rotation(angleRadians, axis[0], axis[1], axis[2]).times(velocity.to4(false)).to3(); 
    }

    this.direction = velocity.normalized();

    this.angle = (1 - roll_speed_coefficient) * this.angle + roll_speed_coefficient * max_roll_angle * turn_x;
  }

  draw(context, program_state, initial_transformation = Mat4.identity()) {
    let bird_transform = initial_transformation;

    // Rotate model in model space such that bird beak is facing correctly
    bird_transform.pre_multiply(Mat4.rotation(- Math.PI, 0,1,0));
    // Add roll when turning
    bird_transform.pre_multiply(Mat4.rotation(this.angle, 0,0,-1));
    // Make bird face its own direction
    bird_transform.pre_multiply(Mat4.inverse(Mat4.look_at(vec3(0,0,0), this.direction, this.position)));
    // Translate to bird position in world space
    bird_transform.pre_multiply(Mat4.translation(...this.position));
    this.shape.draw(context, program_state, bird_transform, this.material);

  }
}