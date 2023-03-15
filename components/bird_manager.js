
export class BirdManager {

  flock_range = 40;
  minimum_distance = 10;
  seperation_lerp_amount = 0.22;
  alignment_lerp_amount = 0.2;
  cohesion_lerp_amount = 0.2;

  collision_avoidance_lerp_amount = 0.2;

  constructor() {
    this.birds = []
  }

  add_bird(bird) {
    this.birds.push(bird);
  }

  get_birds() {
    return this.birds;
  }
}