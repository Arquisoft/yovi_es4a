import LocalHvHVariantPage from "../game/LocalHvHVariantPage";

function invertWinner(winner: string | null): string | null {
  if (winner === "player0") return "player1";
  if (winner === "player1") return "player0";
  return winner;
}

export default function GameWhyNot() {
  return (
    <LocalHvHVariantPage
      title="Juego Y — WhY Not"
      mode="why_not_hvh"
      opponent="Jugador local (WhY Not)"
      subtitleSuffix="Conectar los tres lados te hace perder"
      mapWinner={invertWinner}
    />
  );
}