import { fireEvent, render, screen } from "@testing-library/react";
import { AudioPlayer } from "./AudioPlayer";

it("offers a labelled play button and a seekable waveform instead of the browser's controls", () => {
  const { container } = render(<AudioPlayer src="/audio/x.mp3" peaks={new Float32Array([-0.5, 0.5, -0.2, 0.2])} label="A normal breath" />);
  expect(screen.getByRole("button", { name: "Play: A normal breath" })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Position in A normal breath" })).toBeInTheDocument();
  expect(container.querySelector("audio")).not.toHaveAttribute("controls");
});

it("keeps the arrow keys on the clip so presenter mode does not step", () => {
  render(<AudioPlayer src="/audio/x.mp3" peaks={null} label="Clip" />);
  const audio = document.querySelector("audio")!;
  Object.defineProperty(audio, "duration", { value: 8 });
  const onWindow = vi.fn();
  window.addEventListener("keydown", onWindow);
  fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
  window.removeEventListener("keydown", onWindow);
  expect(onWindow).not.toHaveBeenCalled();
});
