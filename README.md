# Boids

Team Member: Narek Daduryan | 305 391 327 | [narekdaduryan@gmail.com](mailto:narekdaduryan@gmail.com)

### Theme

You are a lone bird tired of your hometown and decide to head for adventure. You fly with other fellow birds as you explore the world!

In the past I had created a [boids](https://en.wikipedia.org/wiki/Boids) simulation in 2D. I plan to extend this to 3D, and include a continuous globe over which the birds can fly and explore. You will control one of the birds as others fly around and with you.

### Topics Used

Will use basic shading, transformations, matrices, and cameras to build a world and place many birds on the scene. Will use emergent behavior (boids) to control autonomous birds, which relies on vector and matrix mathematics.

### Demo

<img src="https://i.imgur.com/ny1XIMn.gif" width="600" height="338" />

### Interactivity

You are able to control your bird in third-person, and watch as the other boids interact with you. I implemented a player-controller that allows you to orbit around a small globe.

**Player Controls**  
`W A S D - Move Bird`  
`R - Toggle Camera View`

### Emergent Behavior

I used the basic Boid framework (cohesion, separation, alignment) as a baseline. This formulation suffers from all boids converging to one flock over time. I used a few additions to help overcome this. I added slight randomness to each boid's preferences (cohesion, separation, and alignment coefficients). I also added "break aways" where each boid has a small chance to want to break away from the flock and go in a separate direction. This helps keep a good mix of big and small flocks. Lastly, I added obstacle avoidance by adding **collision detection** : I check each boid's trajectory with the terrain, and if it collides, I add a strong opposing force.

### Graphics Features

The game uses **primitive objects** and **.obj objects** to draw the globe, birds, and trees. Each is shaded using **phong** or **textured phong** shaders. I implemented **fog** to add a sense of depth to the scene.


<img src="https://i.imgur.com/kCNXy67.png" width="400" height="270" />

There are also **two camera views** : You can either view your bird in third person, or zoom out to view the globe to better see the action going on.

I used a custom **terrain shader** to add a stylized look to the terrain. The shader uses the height of each vertex above the origin to determine the materia – sand, grass, or snow, and also uses the vertex's normal to determine if it should be a rocky material.

<img src="https://i.imgur.com/IktJMTy.png" width="400" height="270" />

I implemented a stylized **water shader** to make the water look nicer. The water shader has waves using animation time. I also implemented a water-depth-based water shading. To enable this, I first render the globe terrain's height to a frame buffer. Then, I sample the terrain height in the water shader to determine the _water depth_. I then add some white ripples when the water is shallow, and make the water darker when it's deeper.

<img src="https://i.imgur.com/ZUUg389.gif" width="400" height="270" />

I also added a simple **animation** to the bird's wings. When diving, the wings stay flat. During normal flying, they flap, and when ascending quickly, they flap faster.

I also implemented a **skybox** for my world. To do this, I used a 6-sided cubemap and rendered it in clip-space based on the camera view angle.

### Next Steps

Further **optimization** is needed to make the game more performant. Currently, I am able to simulate about 300 boids in the world, with low-accuracy collision detection.

The collision detection takes a long time, since it is run on the CPU rather than GPU, and checks each boid with each triangle of the terrain. As an optimization, I batched the collision detection, so each frame, only ~5 birds check their collision. On average, each bird gets it collision checked every 60 frames.

I also added basic culling for birds and trees to not draw them if they are on other side of the globe.

As an optimization, it would be best to add some spatial map (quadtree or hashmap, etc) for the boid calculations, so boids can quickly index nearby boids when doing calculations. Moving the collision detection to a compute shader would also be a large speedup.

### References

Sebastian Lague Coding Adventures (eg [Link 1](https://www.youtube.com/watch?v=sLqXFF8mlEU), [Link 2](https://www.youtube.com/watch?v=DxfEbulyFcY&t=1167s))

My own 2D boid implementation ([Link](https://github.com/dadur604/boids))

Boids Reference & Enhancements ([Stanford](https://cs.stanford.edu/people/eroberts/courses/soco/projects/2008-09/modeling-natural-systems/boids.html#:~:text=Boids%20is%20an%20artificial%20life,behavior%20of%20each%20individual%20bird.), [U-Turns](https://zyrxvo.github.io/files/garett_brown_senior_thesis.pdf))

WebGl references ([Skybox](https://webglfundamentals.org/webgl/lessons/webgl-skybox.html), [Buffers](https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html))

Stylized Water Shader Ideas ([Link](https://alexanderameye.github.io/notes/stylized-water-shader/))

Low Poly Bird Object: ([Link](https://sketchfab.com/3d-models/low-poly-bird-db7d3a43dea0491db49a8a20966da8ca))

Low Poly Trees Pack ([Link](https://brokenvector.itch.io/low-poly-tree-pack))

This project is tested with Browserstack
