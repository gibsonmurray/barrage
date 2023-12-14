import { gsap } from "gsap";

/* ---- GLOBALS ---- */

const canvas = document.querySelector("#game");
const pen = canvas.getContext("2d");
const scoreDOM = document.querySelector("#score");
const radius = 15;
const sliderWidth = 240;
const colors = {
  white: "#ffffff",
  green: "#13E297",
};
let sound = true;

/* ---- GAME OBJECTS ---- */

class Circle {
  constructor() {
    this.radius = radius;
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.color = colors.green;
    this.dx = 2.5; // Speed of the circle's movement
    this.sliderLeft = canvas.width / 2 - sliderWidth / 2;
    this.sliderRight = canvas.width / 2 + sliderWidth / 2;
    this.opacity = 0;
    this.ox = 0.08;
  }

  draw() {
    pen.beginPath();
    pen.globalAlpha = this.opacity;
    pen.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    pen.fillStyle = this.color;
    pen.fill();
    pen.closePath();
    pen.globalAlpha = 1;
  }

  update() {
    this.x += this.dx;
    this.opacity = this.opacity < 1 ? this.opacity + this.ox : 1;

    // Check for collision with the slider edges
    if (
      this.x - this.radius <= this.sliderLeft ||
      this.x + this.radius >= this.sliderRight
    ) {
      playSideBumpMP3();
      this.dx = -this.dx; // Reverse the direction
    }
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = randomNumBetween(5, 7);
    this.speedX = randomNumBetween(-6, 6);
    this.speedY = randomNumBetween(-6, 6);
    this.color = colors.green;
  }

  draw() {
    pen.fillStyle = this.color;
    pen.beginPath();
    pen.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
    pen.fill();
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.size -= 0.15;
    if (this.size < 0) {
      this.size = 0;
    }
  }
}

class Square {
  constructor(speed, enemy = true) {
    this.enemy = enemy;
    this.color = this.enemy ? colors.white : colors.green;
    this.size = radius * 2;
    this.x = randomNumBetween(0, canvas.width - this.size);
    this.y = -this.size;
    this.angle = 0;
    this.direction = this.x < canvas.width / 2 ? 1 : -1;
    this.dr = 0.01 * speed * this.direction;
    this.dx = randomNumBetween(0, 1) * this.direction * 0.5;
    this.dy = speed;
    this.scale = 1;
    this.ds = 0.02 * speed;
    this.maxDepth = 380;
    this.isDone = false; // for falling off
    this.isCaught = false; // for friendly capture
  }

  draw() {
    pen.save();
    pen.translate(this.x + this.size / 2, this.y + this.size / 2);
    pen.rotate(this.angle);
    pen.scale(this.scale, this.scale);
    pen.fillStyle = this.color;
    pen.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    pen.restore();
  }

  update() {
    if (gameOver || this.isDone) {
      this.scale -= this.isCaught ? 0.1 : this.ds;
      if (this.scale <= 0) {
        this.scale = 0;
      }
    } else {
      if (this.y > this.maxDepth && !this.isDone) {
        this.isDone = true;
        this.dx = 0;
        this.dy = 0;
      }

      this.angle += this.dr;
      this.x += this.dx;
      this.y += this.dy;
    }

    this.draw();
  }
}

/* ---- GAMEPLAY ---- */

let circle,
  squares,
  lastSquareTime,
  squareInterval,
  squareVelocity,
  squareCounter,
  enemyFrequency,
  animationFrameId,
  gameOver,
  particles,
  exploded,
  menuVisible,
  prevScore,
  score;

function init() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  circle = new Circle();
  squares = [];
  particles = [];
  lastSquareTime = 0;
  squareInterval = 1000; // ms
  squareVelocity = 2; // rate at which the squares fall
  squareCounter = 0;
  enemyFrequency = 4; // every ~4 enemies there is a point
  gameOver = false;
  exploded = false;
  menuVisible = false;
  prevScore = score ?? 0;
  score = 0;
  lastSquareTime = performance.now();
  animate(lastSquareTime);
  scoreDOM.innerHTML = score;
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);
  pen.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameOver) {
    circle.update();
    circle.draw();
  } else {
    !exploded && addParticlesForExplosion();
    circleExplode();
    !menuVisible && gameOverTransition();
  }

  // Add new square at intervals
  if (currentTime - lastSquareTime > squareInterval) {
    addSquare();
    lastSquareTime = currentTime;
  }

  // Update squares
  squares.forEach((square) => {
    square.update();

    if (square.enemy) {
      handleEnemyCollisions(square);
    } else {
      handleFriendlyCollisions(square);
    }
  });

  cleanUpSquares();
}

function addSquare() {
  const enemy = (squareCounter + 1) % enemyFrequency > 0;
  squareCounter++;
  squares.push(new Square(squareVelocity, enemy));
}

function handleEnemyCollisions(square) {
  if (checkCollision(circle, square) && !gameOver) {
    gameOver = true;
  }
}

function handleFriendlyCollisions(square) {
  if (checkCollision(circle, square) && !square.isCaught && !gameOver) {
    playPointMP3();
    scoreIncrease();
    square.isDone = true;
    square.isCaught = true;
    score++;
    scoreDOM.innerHTML = score;

    // Every 4 points make it harder >:)
    if (score % 4 === 0 && score !== 0) {
      increaseDifficulty();
    }
  }
}

function addParticlesForExplosion() {
  for (let i = 0; i < 16; i++) {
    particles.push(new Particle(circle.x, circle.y));
  }
  exploded = true;
  playExplodeMP3();
}

function circleExplode() {
  particles.forEach((particle) => {
    particle.update();
    particle.draw();
  });

  cleanUpParticles();
}

function cleanUpParticles() {
  particles = particles.filter((particle) => particle.size > 0);
}

function cleanUpSquares() {
  squares = squares.filter((square) => square.scale > 0);
}

function increaseDifficulty() {
  circle.dx += circle.dx < 0 ? -0.3 : 0.3;
  squareVelocity += 0.3;
  squareInterval -= 100;
}

init();

/* ---- COLLISIONS ---- */

// NOTE: does not account for rotations
function checkCollision(circle, square) {
  // Check if the circle's area overlaps with the square's area
  let distX = Math.abs(circle.x - square.x - square.size / 2);
  let distY = Math.abs(circle.y - square.y - square.size / 2);

  if (
    distX > square.size / 2 + circle.radius ||
    distY > square.size / 2 + circle.radius
  ) {
    return false; // No collision
  }

  if (distX <= square.size / 2 || distY <= square.size / 2) {
    return true; // Collision
  }

  // Check corner collisions
  let dx = distX - square.size / 2;
  let dy = distY - square.size / 2;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

/* ---- USER INTERACTION ---- */

function toggleDirection(event) {
  // only works with space and mouse/touch down
  if (
    gameOver ||
    (event.type === "keydown" && event.key !== " " && event.key !== "Space")
  ) {
    return;
  }

  // fixes bug where circle would stick to a side if tapped while it was on boundary of slider
  const sliderX = canvas.width / 2 - sliderWidth / 2;
  if (
    circle.x - circle.radius > sliderX &&
    circle.x + circle.radius < sliderX + sliderWidth
  ) {
    playSwitchDirectionsMP3();
    circle.dx *= -1;
  }
}

if (window.innerWidth < 1000) {
  window.addEventListener("touchstart", toggleDirection);
} else {
  window.addEventListener("click", toggleDirection);
  window.addEventListener("keydown", toggleDirection);
}

const restartBtn = document.querySelector("#replay");
restartBtn.addEventListener("click", restartTransition);

const audioBtn = document.querySelector("#sound");
audioBtn.addEventListener("click", () => {
  sound = !sound;
  audioBtn.innerHTML = sound ?
    `<path
  d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zm233.32-51.08c-11.17-7.33-26.18-4.24-33.51 6.95-7.34 11.17-4.22 26.18 6.95 33.51 66.27 43.49 105.82 116.6 105.82 195.58 0 78.98-39.55 152.09-105.82 195.58-11.17 7.32-14.29 22.34-6.95 33.5 7.04 10.71 21.93 14.56 33.51 6.95C528.27 439.58 576 351.33 576 256S528.27 72.43 448.35 19.97zM480 256c0-63.53-32.06-121.94-85.77-156.24-11.19-7.14-26.03-3.82-33.12 7.46s-3.78 26.21 7.41 33.36C408.27 165.97 432 209.11 432 256s-23.73 90.03-63.48 115.42c-11.19 7.14-14.5 22.07-7.41 33.36 6.51 10.36 21.12 15.14 33.12 7.46C447.94 377.94 480 319.54 480 256zm-141.77-76.87c-11.58-6.33-26.19-2.16-32.61 9.45-6.39 11.61-2.16 26.2 9.45 32.61C327.98 228.28 336 241.63 336 256c0 14.38-8.02 27.72-20.92 34.81-11.61 6.41-15.84 21-9.45 32.61 6.43 11.66 21.05 15.8 32.61 9.45 28.23-15.55 45.77-45 45.77-76.88s-17.54-61.32-45.78-76.86z" />`
    :
    `<path d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zM461.64 256l45.64-45.64c6.3-6.3 6.3-16.52 0-22.82l-22.82-22.82c-6.3-6.3-16.52-6.3-22.82 0L416 210.36l-45.64-45.64c-6.3-6.3-16.52-6.3-22.82 0l-22.82 22.82c-6.3 6.3-6.3 16.52 0 22.82L370.36 256l-45.63 45.63c-6.3 6.3-6.3 16.52 0 22.82l22.82 22.82c6.3 6.3 16.52 6.3 22.82 0L416 301.64l45.64 45.64c6.3 6.3 16.52 6.3 22.82 0l22.82-22.82c6.3-6.3 6.3-16.52 0-22.82L461.64 256z" />`
});

const shareBtn = document.querySelector("#share");
shareBtn.addEventListener('click', () => {
  const gameLink = "https://barrage-gibsonmurray.vercel.app/";
  const tweetText = "I just got a score of " + score + " on Barrage! Try and beat me: " + gameLink;
  const twitterUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetText);
  window.open(twitterUrl, '_blank');
});


/* ---- USER INTERFACE ---- */

function gameOverTransition() {
  menuVisible = true;
  const tl = gsap.timeline();
  tl.add(
    gsap.to("#score", {
      y: "-=230",
      fontSize: 170,
      color: colors.green,
      onComplete: function () {
        if (score > prevScore) {
          playHighScoreMP3();
        }
      }
    }),
    1
  )
    .add(
      gsap.to("#high-score", {
        opacity: score > prevScore ? 1 : 0,
        repeat: -1,
        yoyo: true
      })
    )
    .add(
      gsap.to("#slider", {
        height: "+=50",
        y: "+=170",
        zIndex: 2
      }),
      1.2
    )
    .add(
      gsap.to("#slider > *", {
        scale: 1,
        stagger: 0.2
      })
    );
  tl.play();
}

function restartTransition() {
  gsap.killTweensOf(["#score", "#high-score", "#slider", "#slider > *"]);
  const tl = gsap.timeline();
  tl.add(
    gsap.to("#slider > *", {
      scale: 0,
      stagger: 0.2
    })
  )
    .add(
      gsap.to("#high-score", {
        opacity: 0
      })
    )
    .add(
      gsap.to("#slider", {
        height: "-=50",
        y: "-=170",
        zIndex: 0
      }),
      1
    )
    .add(
      gsap.to("#score", {
        y: "+=230",
        fontSize: 72,
        color: colors.white,
        onComplete: function () {
          setTimeout(init, 700);
        }
      }),
      1.2
    );
  tl.play();
}

function scoreIncrease() {
  gsap.to("#score", {
    scale: 1.1,
    yoyo: true,
    repeat: 1,
    duration: 0.08
  });
}

/* ---- AUDIO ---- */

function playSideBumpMP3() {
  const sideBumpMP3 = new Audio("./bump-side.mp3");
  sound && sideBumpMP3.play();
}

function playSwitchDirectionsMP3() {
  const switchDirectionsMP3 = new Audio("./switch-directions.mp3");
  sound && switchDirectionsMP3.play();
}

function playPointMP3() {
  const pointMP3 = new Audio("./point.mp3");
  sound && pointMP3.play();
}

function playExplodeMP3() {
  const explodeMP3 = new Audio("./explode.mp3");
  sound && explodeMP3.play();
}

function playHighScoreMP3() {
  const highScoreMP3 = new Audio("./high-score.mp3");
  sound && highScoreMP3.play();
}

/* ---- UTILITIES ---- */

function randomNumBetween(min, max) {
  return Math.random() * (max - min + 1) + min;
}

// TODO: TOGGLE AUDIO, SHARE
