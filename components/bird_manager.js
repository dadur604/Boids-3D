export const percent_unique_birds = 0.1;
export const bird_speed = 20;

export class BirdManager {

  flock_range = 40;
  minimum_distance = 10;
  seperation_lerp_amount = 0.22;
  alignment_lerp_amount = 0.2;
  cohesion_lerp_amount = 0.2;

  collision_avoidance_lerp_amount = 0.2;

  // % chance per second to perform a brake away
  brake_away_chance = 0.02;
  brake_away_duration = 3;

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