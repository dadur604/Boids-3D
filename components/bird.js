import {defs, tiny} from '../examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const bird_speed = 20;
const turn_speed = 0.5;
const smooth_y_coefficient = 0.1
const max_roll_angle = 0.3;
const roll_speed_coefficient = 0.02

const min_height = 120;
const max_height = 300;
const height_clamp_boundary = 3.0;

export class Bird {
  constructor(bird_manager, position, direction, shape, material) {
    this.bird_manager = bird_manager;
    this.bird_manager.add_bird(this);

    this.position = position
    this.direction = direction;
    this.elevation_angle = 0;

    this.shape = shape;
    this.material = material;

    // roll angle is just visual
    this.roll_angle = 0;

    this.smoothed_y = 0;

    this.bird_speed = bird_speed;
  }

  // turn_x -1 or +1 if turning left or right.
  // turn_y -1 or +1 if going down or up.
  // Undefined if not player-controlled
  update(dt, player_controls) {
    const {turn_x, turn_y} = player_controls || {turn_x: 0, turn_y: 0};

    const gravity_vector = this.position.times(-1).normalized();
    let current_height = this.position.norm();

    this.bird_speed *= (Math.random() * 0.02) + 0.99;

    
    // Set velocity to dir * speed * dt
    let velocity = this.direction.normalized();

    if (!player_controls) {
      velocity = this.calculateBoidDesiredDirection().normalized();
    }

    velocity.scale_by(this.bird_speed);
    velocity.scale_by(dt);
    
    // Add velocity to position
    const new_position = this.position.plus(velocity);

    let elevation_angle = - Math.PI / 2 + Math.acos(velocity.normalized().dot(gravity_vector));
    const speed_y = Math.sin(elevation_angle) * this.bird_speed;
    current_height += speed_y * dt;
    
    // Clamp to current height around globe
    this.position = new_position.normalized().times(current_height);

    // Set rotation and velocity to match around globe
    const fromDirection = velocity.cross(gravity_vector.cross(velocity));
    const toDirection = gravity_vector;
    const axis = fromDirection.cross(toDirection);
    let angleRadians = Math.acos(fromDirection.normalized().dot(toDirection.normalized()));

    // First turn bird according to turn_x
    velocity = Mat4.rotation(turn_x * turn_speed * dt, gravity_vector[0], gravity_vector[1], gravity_vector[2]).times(velocity.to4(false)).to3();
    // Then turn bird accourding to turn_y
    const roll_axis = gravity_vector.cross(velocity);

    this.smoothed_y = (1 - smooth_y_coefficient) * this.smoothed_y + smooth_y_coefficient * turn_y;

    let clamped_turn_y = this.smoothed_y;
    
    // Clamp close to ground; start pitching up
    if (current_height < (min_height + height_clamp_boundary)) {
      const t = (height_clamp_boundary - (current_height - min_height)) / height_clamp_boundary;
      clamped_turn_y = t * 1 + (1-t) * clamped_turn_y;
    }
    // Clamp too high; start pitching down
    if (current_height > (max_height - height_clamp_boundary)) {
      const t = (height_clamp_boundary - (max_height - current_height)) / height_clamp_boundary;
      clamped_turn_y = t * -1 + (1-t) * clamped_turn_y;
    }

    velocity = Mat4.rotation(clamped_turn_y * 20 * dt, roll_axis[0], roll_axis[1], roll_axis[2]).times(velocity.to4(false)).to3();

    // Then turn bird according to sphere
    if (!isNaN(angleRadians)) {
        while (angleRadians > (Math.PI / 2)) {
            angleRadians -= (Math.PI)
        }
        velocity = Mat4.rotation(angleRadians, axis[0], axis[1], axis[2]).times(velocity.to4(false)).to3(); 
    }


    let visual_turn_x = - Math.PI / 2 + Math.acos(velocity.normalized().dot(this.direction.cross(gravity_vector).normalized()));
    visual_turn_x *= 500
    visual_turn_x = Math.max(-1, Math.min(1, visual_turn_x));

    this.direction = velocity.normalized();
    
    this.roll_angle = (1 - roll_speed_coefficient) * this.roll_angle + roll_speed_coefficient * max_roll_angle * visual_turn_x;
  }

  calculateBoidDesiredDirection() {
    const birds = this.bird_manager.get_birds();

    let numBirdsInFlock = 0;

    // Seperation
    let seperationDirection = vec3(0,0,0);

    // Alignment
    let averageAlignment = vec3(0,0,0);

    // Cohesion
    let cohesionDirection = vec3(0,0,0);
    let localCenterOfMass = vec3(0,0,0);

    let direction = this.direction.copy();

    // Calculate values over all birds in nearby flock
    for (const bird of birds) {
      // don't calculate ourselves
      if (bird === this) continue;

      if (bird.position.minus(this.position).norm() >= this.bird_manager.flock_range) continue;

      numBirdsInFlock++;

      // Seperation

      let difference = this.position.minus(bird.position);
      if (difference.norm() !== 0) {
        let awayDirection = difference.normalized();
        seperationDirection.add_by(
          awayDirection.times(1 + (this.bird_manager.minimum_distance / difference.norm()))
        )
      }
      

      // Alignment
      averageAlignment.add_by(bird.direction);

      // Cohesion
      localCenterOfMass.add_by(bird.position);
    }

    if (numBirdsInFlock === 0) return this.direction;

    // Calculate our own boid values
    
    // Sepeartion
    if (seperationDirection.norm() != 0) {
      seperationDirection.scale_by(1.0 / numBirdsInFlock);
      const t = this.bird_manager.seperation_lerp_amount;
      direction = seperationDirection.normalized().times(t).plus(direction.times(1-t));
      direction.normalize();
    }

    // Alignment
    if (averageAlignment.norm() != 0) {
      averageAlignment.scale_by(1.0 / numBirdsInFlock);
      const t = this.bird_manager.alignment_lerp_amount;
      direction = averageAlignment.normalized().times(t).plus(direction.times(1-t));
      direction.normalize();
    }

    // Cohesion
    if (localCenterOfMass.norm() != 0) {
      localCenterOfMass.scale_by(1.0 / numBirdsInFlock);
      cohesionDirection = localCenterOfMass.minus(this.position.copy());
      const t = this.bird_manager.cohesion_lerp_amount;
      direction = cohesionDirection.normalized().times(t).plus(direction.times(1-t));
      direction.normalize();
    }

    return direction;
  }

  draw(context, program_state, initial_transformation = Mat4.identity()) {
    let bird_transform = initial_transformation;

    // Rotate model in model space such that bird beak is facing correctly
    bird_transform.pre_multiply(Mat4.rotation(- Math.PI, 0,1,0));
    // Add roll when turning
    bird_transform.pre_multiply(Mat4.rotation(this.roll_angle, 0,0,-1));
    // Make bird face its own direction
    bird_transform.pre_multiply(Mat4.inverse(Mat4.look_at(vec3(0,0,0), this.direction, this.position)));
    // Translate to bird position in world space
    bird_transform.pre_multiply(Mat4.translation(...this.position));
    this.shape.draw(context, program_state, bird_transform, this.material);

  }
}