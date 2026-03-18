import { Tabs, Typography } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function HelpModal() {
  return (
    <Tabs
      defaultActiveKey="rules"
      items={[
        {
          key: "rules",
          label: "Reglas del Juego Y",
          children: (
            <Typography>
              <Title level={5}>Objetivo</Title>
              <Paragraph>
                El juego Y se juega en un tablero triangular. El objetivo es
                conectar los <Text strong>tres lados del triángulo</Text> con
                una cadena continua de tus fichas.
              </Paragraph>

              <Title level={5}>Turnos</Title>
              <Paragraph>
                Los jugadores se alternan colocando <Text strong>una ficha</Text>{" "}
                en cualquier celda vacía del tablero.{" "}
                No se puede mover ni quitar una ficha ya colocada.
              </Paragraph>

              <Title level={5}>Condición de victoria</Title>
              <Paragraph>
                Gana el jugador que logre formar un grupo de fichas conectadas
                que toque los <Text strong>tres lados</Text> del triángulo al
                mismo tiempo. Las fichas se conectan con sus vecinas adyacentes.
              </Paragraph>

              <Title level={5}>Tablero</Title>
              <Paragraph>
                El tamaño del tablero es configurable. Un
                tablero más grande implica partidas más largas y estratégicas.
              </Paragraph>
            </Typography>
          ),
        },
        {
          key: "modes",
          label: "Modos de Juego",
          children: (
            <Typography>
              <Title level={5}>Human vs Bot (HvB)</Title>
              <Paragraph>
                Juegas contra la inteligencia artificial. Puedes elegir el bot
                con el que enfrentarte:
              </Paragraph>
              <ul>
                <li>
                  <Text strong>random_bot</Text> — coloca fichas de forma
                  aleatoria. Ideal para aprender.
                </li>
                <li>
                  <Text strong>mcts_bot</Text> — usa el algoritmo Monte Carlo
                  Tree Search. Mucho más difícil de vencer.
                </li>
              </ul>
              <Paragraph>
                También puedes elegir quién empieza: tú (Human) o el bot.
              </Paragraph>

              <Title level={5}>Human vs Human (HvH)</Title>
              <Paragraph>
                Dos jugadores humanos se turnan en el mismo dispositivo.
                Se identifica a los jugadores como{" "}
                <Text strong>Player 0</Text> (fichas azules) y{" "}
                <Text strong>Player 1</Text> (fichas rojas). Puedes elegir quién
                coloca la primera ficha.
              </Paragraph>
            </Typography>
          ),
        },
        {
          key: "howto",
          label: "Cómo usar la app",
          children: (
            <Typography>
              <Title level={5}>Pantalla de inicio</Title>
              <Paragraph>
                Al entrar, verás la pantalla de bienvenida. Regístrate la primera vez
                para poder guardar tus estadísticas.
              </Paragraph>

              <Title level={5}>Crear partida</Title>
              <Paragraph>
                Elige el tamaño del tablero, el modo de juego y quién empieza, 
                luego pulsa{" "}
                <Text strong>Jugar</Text>.
              </Paragraph>

              <Title level={5}>Durante la partida</Title>
              <Paragraph>
                Haz clic en una celda vacía para colocar tu ficha. El turno
                actual se muestra en la barra superior. Si quieres terminar
                antes, pulsa <Text strong type="danger">Abandonar</Text>.
              </Paragraph>

              <Title level={5}>Ranking y Estadísticas</Title>
              <Paragraph>
                Consulta el ranking global y a tus propias estadísticas desde el menú de usuario.
              </Paragraph>
            </Typography>
          ),
        },
        {
          key: "faq",
          label: "FAQ",
          children: (
            <Typography>
              <Title level={5}>¿Puedo deshacer un movimiento?</Title>
              <Paragraph>
                No. Una vez colocada una ficha, no se puede retirar ni mover.
                Piensa bien antes de jugar.
              </Paragraph>

              <Title level={5}>¿Qué pasa si abandono una partida?</Title>
              <Paragraph>
                La partida cuenta como si se hubiera perdido.
              </Paragraph>

              <Title level={5}>¿Qué tamaño de tablero recomendáis?</Title>
              <Paragraph>
                Para empezar, un tablero de tamaño <Text strong>5 o 7</Text> es
                ideal. Los tableros grandes (10+) son para partidas largas y
                estrategia avanzada.
              </Paragraph>

              <Title level={5}>¿El bot tarda en responder?</Title>
              <Paragraph>
                El <Text strong>random_bot</Text> responde al instante. El{" "}
                <Text strong>mcts_bot</Text> puede tardar unos segundos porque
                calcula muchas jugadas posibles.
              </Paragraph>

              <Title level={5}>¿Cómo sé quién ha ganado?</Title>
              <Paragraph>
                Al terminar la partida aparece un mensaje indicando el ganador.
                El tablero queda bloqueado y no se pueden hacer más movimientos.
              </Paragraph>
            </Typography>
          ),
        },
      ]}
    />
  );
}