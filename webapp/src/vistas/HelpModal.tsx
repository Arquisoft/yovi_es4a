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
                Los jugadores se alternan colocando{" "}
                <Text strong>una ficha</Text> en cualquier celda vacía del
                tablero. No se puede mover ni quitar una ficha ya colocada.
              </Paragraph>

              <Title level={5}>Condición de victoria</Title>
              <Paragraph>
                Gana el jugador que logre formar un grupo de fichas conectadas
                que toque los <Text strong>tres lados</Text> del triángulo al
                mismo tiempo. Las fichas se conectan con sus vecinas adyacentes.
              </Paragraph>

              <Title level={5}>Tablero</Title>
              <Paragraph>
                El tamaño del tablero es configurable. Un tablero más grande
                implica partidas más largas y estratégicas.
              </Paragraph>
            </Typography>
          ),
        },
        {
          key: "modes",
          label: "Modos de Juego",
          children: (
            <Typography>
              <Title level={4}>Clásico - Human vs Bot (HvB)</Title>
              <Paragraph>
                Juegas contra la máquina. Puedes elegir la dificultad del bot
                con el que enfrentarte:
              </Paragraph>
              <ul>
                <li>
                  <Text strong>Fácil</Text> — coloca fichas de forma
                  aleatoria. Ideal para aprender.
                </li>
                <li>
                  <Text strong>Medio</Text> — Analiza un número limitado de
                  posibles juagdas. Empieza a ser un reto
                </li>
                <li>
                  <Text strong>Difícil</Text> — Analiza un número elevado de
                  posibles juagdas. Un reto para jugadores experimentados.
                </li>
                <li>
                  <Text strong>Demencial</Text> — Hace simulaciones masivas de
                  jugadas para elegir la mejor. Solo para los más valientes.
                </li>
              </ul>
              <Paragraph>
                También puedes elegir quién empieza: tú (Human), el bot o de forma aleatoria.
              </Paragraph>

              <Title level={4}>Clásico - Human vs Human (HvH)</Title>
              <Paragraph>
                Dos jugadores humanos se turnan en el mismo dispositivo. Se
                identifica a los jugadores como <Text strong>Player 0</Text>{" "}
                (fichas azules) y <Text strong>Player 1</Text> (fichas
                naranjas). Puedes elegir quién coloca la primera ficha.
              </Paragraph>

              <Title level={4}>Otras variantes HvH</Title>

              <Title level={5}>Regla del Pastel</Title>
              <Paragraph>
                El primer jugador escoge una celda del tablero. Entonces, 
                el segundo jugador tiene la opción de elegir si quedarse con
                esa celda o ceder el turno.
              </Paragraph>

              <Title level={5}>Master Y</Title>
              <Paragraph>
                Las reglas son las mismas que el modo clásico, pero aquí cada jugador 
                coloca dos fichas seguidas en vez de una.
              </Paragraph>

              <Title level={5}>Fortune Moneda</Title>
              <Paragraph>
                En cada turno se lanza una moneda virtual, que escoge a qué jugador
                le toca colocar la ficha. El turno es completamente aleatorio.
              </Paragraph>

              <Title level={5}>Fortune Dado</Title>
              <Paragraph>
                En cada turno se lanza un dado virtual, que determina el número de
                fichas que coloca el jugador en ese turno.
              </Paragraph>

              <Title level={5}>Tabú</Title>
              <Paragraph>
                Cada vez que un jugador coloca una ficha, se bloquean para el
                siguiente turno las casillas adyacentes. De esta forma, el siguiente
                jugador no podrá colocar su ficha en esas posiciones bloqueadas.
              </Paragraph>

              <Title level={5}>Holey</Title>
              <Paragraph>
                Al inicio de la partida se bloquean aleatoriamente un número de
                casillas del tablero. Estas casillas bloqueadas no pueden ser utilizadas
                por ningún jugador durante toda la partida.
              </Paragraph>

              <Title level={5}>WhY Not</Title>
              <Paragraph>
                El mecanismo de juego es el básico, pero la norma de victoria es diferente:
                el jugador que consiga conectar los tres laterales del tablero 
                <Text strong>pierde</Text>.
              </Paragraph>

              <Title level={4}>Multiplayer Online</Title>
              <Paragraph>
                En esta versión podrás jugar con tus amigos. Crea una sala con la
                variante que quieras e invita a algún amigo a unirse. También puedes unirte
                a otras salas con el código correspondiente para jugar con otros usuarios de la app.
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
                Al entrar, verás la pantalla de bienvenida. Regístrate la
                primera vez para poder guardar tus estadísticas.
              </Paragraph>

              <Title level={5}>Crear partida</Title>
              <Paragraph>
                Elige el tamaño del tablero, el modo de juego y quién empieza,
                luego pulsa <Text strong>Jugar</Text>.
              </Paragraph>

              <Title level={5}>Durante la partida</Title>
              <Paragraph>
                Haz clic en una celda vacía para colocar tu ficha. El turno
                actual se muestra en la barra superior. Si quieres terminar
                antes, pulsa{" "}
                <Text strong type="danger">
                  Abandonar
                </Text>
                .
              </Paragraph>

              <Title level={5}>Ranking y Estadísticas</Title>
              <Paragraph>
                Consulta el ranking global y a tus propias estadísticas desde el
                menú de usuario.
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
              <Paragraph>La partida cuenta como abandonada.</Paragraph>

              <Title level={5}>¿Qué tamaño de tablero recomendáis?</Title>
              <Paragraph>
                Para empezar, un tablero de tamaño <Text strong>5 o 7</Text> es
                ideal. Los tableros grandes (10+) son para partidas largas y
                estrategia avanzada.
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
