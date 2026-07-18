import "./styles.css";
import { GameApp } from "./app/GameApp";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

const game = new GameApp(root);

void game.start();
