const button = document.getElementById("playButton");
const sound = document.getElementById("sound");

button.addEventListener("click", () => {
  sound.play();
});
