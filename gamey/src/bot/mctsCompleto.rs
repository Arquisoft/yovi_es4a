#![allow(non_snake_case)]

use rand::seq::IndexedRandom;
use rand::Rng;

use crate::{Coordinates, GameStatus, GameY, Movement, PlayerId};
use super::ybot::YBot;

/// Nodo para el Monte Carlo Tree Search.
/// Usamos índices en lugar de referencias explícitas (pointers) para evitar los
/// problemas de ownership en Rust. El árbol completo residirá en un "arena" (un Vec<Node>).
struct MctsNode {
    /// Índice del nodo padre en el arena (None para la raíz)
    parent: Option<usize>,
    /// El movimiento que originó este nodo
    move_idx: Option<u32>,
    /// El jugador que **llevó a cabo** el movimiento que originó este nodo.
    /// Si este nodo gana en la simulación, sumaremos victorias enfocándonos en este jugador.
    who_just_moved: Option<PlayerId>,
    /// Índices de todos los hijos ya expandidos
    children: Vec<usize>,
    /// Los movimientos posibles desde este nodo que aún no hemos explorado
    unexpanded_moves: Vec<u32>,
    /// Número de veces que este nodo (o sus hijos) ha sido visitado
    visits: u32,
    /// Número de victorias obtenidas por `who_just_moved` desde aquí
    wins: f32,
}

impl MctsNode {
    fn new(parent: Option<usize>, move_idx: Option<u32>, who_just_moved: Option<PlayerId>, board: &GameY) -> Self {
        // Obtenemos los movimientos legales desde el tablero en este estado
        let unexpanded_moves = board.available_cells().clone();
        Self {
            parent,
            move_idx,
            who_just_moved,
            children: Vec::new(),
            unexpanded_moves,
            visits: 0,
            wins: 0.0,
        }
    }
}

pub struct MctsCompletoBot {
    /// Nombre del bot en la interfaz/CLI.
    name: &'static str,
    /// Presupuesto total de iteraciones (nodos expandidos) para todo el árbol en cada turno.
    iterations: u32,
}

impl MctsCompletoBot {
    pub fn new(name: &'static str, iterations: u32) -> Self {
        Self { name, iterations }
    }

    /// FASE 3: SIMULACIÓN (Playout rápido)
    /// Este método es idéntico a tu MCTS básico: juega al azar hasta terminar la partida
    /// y devuelve quién ganó.
    fn simulate(&self, mut virtual_board: GameY) -> Option<PlayerId> {
        let mut rng = rand::rng();
        let mut last_move: Option<Coordinates> = None;
        let size = virtual_board.board_size();
        
        loop {
            match virtual_board.status() {
                GameStatus::Finished { winner } => return Some(*winner),
                GameStatus::Ongoing { next_player } => {
                    let available = virtual_board.available_cells();
                    if available.is_empty() {
                        return None;
                    }

                    let move_idx = if let Some(last_coord) = last_move {
                        // Heavy Playout: 75% probabilidad de aplicar una táctica de proximidad
                        if rng.random_bool(0.75) {
                            let k = 3.min(available.len()); // Torneo de tamaño 3
                            let mut best_idx = available[0];
                            let mut min_dist = u32::MAX;

                            for _ in 0..k {
                                let candidate_idx = *available.choose(&mut rng).unwrap();
                                let target_coord = Coordinates::from_index(candidate_idx, size);
                                
                                // Distancia topológica en Hex / Barycentric coords
                                let dist = target_coord.x().abs_diff(last_coord.x())
                                    .max(target_coord.y().abs_diff(last_coord.y()))
                                    .max(target_coord.z().abs_diff(last_coord.z()));

                                if dist < min_dist {
                                    min_dist = dist;
                                    best_idx = candidate_idx;
                                }
                            }
                            best_idx
                        } else {
                            *available.choose(&mut rng).unwrap()
                        }
                    } else {
                        *available.choose(&mut rng).unwrap()
                    };

                    let coords = Coordinates::from_index(move_idx, size);
                    last_move = Some(coords);
                    
                    let _ = virtual_board.add_move(Movement::Placement {
                        player: *next_player,
                        coords,
                    });
                }
            }
        }
    }
}

impl YBot for MctsCompletoBot {
    fn name(&self) -> &str {
        self.name
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        if board.available_cells().is_empty() {
            return None;
        }

        let size = board.board_size();
        let mut rng = rand::rng();

        // Reservar memoria masiva para el árbol. Evitamos redimensionamientos en caliente.
        // Rust llenará esto rapidísimo.
        let mut arena: Vec<MctsNode> = Vec::with_capacity((self.iterations as usize).min(200_000));
        
        // Inicializamos la Raíz
        arena.push(MctsNode::new(None, None, None, board));

        for _ in 0..self.iterations {
            let mut current_node_idx = 0; // Apuntamos a la raíz en cada iteración
            let mut current_board = board.clone();

            // -------------------------------------------------------------
            // FASE 1: SELECCIÓN (Bajar por el árbol)
            // -------------------------------------------------------------
            // Mientras el nodo actual esté totalmente expandido y no sea el fin del juego, 
            // aplicamos UCT para bajar al mejor hijo.
            while !current_board.check_game_over()
                  && arena[current_node_idx].unexpanded_moves.is_empty() 
                  && !arena[current_node_idx].children.is_empty() 
            {
                let mut best_uct = -1.0;
                let mut best_child_idx = 0;
                
                let parent_visits = arena[current_node_idx].visits as f32;
                let log_parent_visits = parent_visits.ln();

                for &child_idx in &arena[current_node_idx].children {
                    let child = &arena[child_idx];
                    let child_visits = child.visits as f32;
                    let uct_score;

                    if child_visits == 0.0 {
                        // Si por algún motivo el hijo no fue visitado, tiene prioridad infinita (exploration)
                        uct_score = f32::MAX;
                    } else {
                        // Explotación: win rate de quién tomó la decisión de llegar aquí
                        let exploitation = child.wins / child_visits;
                        // Exploración: reducimos el factor C a 0.3 para juegos de conexión
                        // Esto hace que el árbol profundice mucho más rápido en lugar de hacer Breadth-First.
                        let exploration = 0.3 * (log_parent_visits / child_visits).sqrt();
                        uct_score = exploitation + exploration;
                    }

                    if uct_score > best_uct {
                        best_uct = uct_score;
                        best_child_idx = child_idx;
                    }
                }

                current_node_idx = best_child_idx;
                
                // Actualizamos el tablero virtual para reflejar el camino que tomamos
                let move_val = arena[current_node_idx].move_idx.unwrap();
                apply_placement_from_idx(&mut current_board, move_val, size);
            }

            // -------------------------------------------------------------
            // FASE 2: EXPANSIÓN
            // -------------------------------------------------------------
            // Si llegamos a un nodo que tiene movimientos por descubrir, descubrimos UNO.
            if !current_board.check_game_over() 
               && !arena[current_node_idx].unexpanded_moves.is_empty() 
            {
                let unexpanded = &mut arena[current_node_idx].unexpanded_moves;
                
                // Extraer al azar un movimiento para expandir. 
                // swap_remove es O(1) tiempo de ejecución en Rust.
                let pick_idx = rng.random_range(0..unexpanded.len());
                let move_idx = unexpanded.swap_remove(pick_idx);

                let mover = current_board.next_player().unwrap();
                
                // Lo aplicamos en nuestro mini tablero simulado
                apply_placement_from_idx(&mut current_board, move_idx, size);

                // Lo añadimos al árbol de verdad
                let new_node = MctsNode::new(Some(current_node_idx), Some(move_idx), Some(mover), &current_board);
                let new_node_idx = arena.len();
                arena.push(new_node);
                arena[current_node_idx].children.push(new_node_idx);
                
                current_node_idx = new_node_idx; // Empezaremos la simulación desde este nodo recién nacido
            }

            // -------------------------------------------------------------
            // FASE 3: SIMULACIÓN
            // -------------------------------------------------------------
            let winner = self.simulate(current_board);

            // -------------------------------------------------------------
            // FASE 4: BACKPROPAGATION (Retropropagación)
            // -------------------------------------------------------------
            let mut backprop_idx = Some(current_node_idx);
            
            while let Some(idx) = backprop_idx {
                let node = &mut arena[idx];
                node.visits += 1;
                
                // El ganador fue el jugador que originó este nodo?
                if let (Some(win_player), Some(node_owner)) = (winner, node.who_just_moved) {
                    if win_player == node_owner {
                        node.wins += 1.0;
                    }
                }
                
                backprop_idx = node.parent; // Subimos al padre
            }
        }

        // -------------------------------------------------------------
        // FIN DEL TURNO: Escoger la mejor jugada
        // -------------------------------------------------------------
        // El movimiento más robusto según el algoritmo MCTS no es el de mayor win-rate,
        // sino el hiperparámetro de robustez: "el hijo de la raíz más VISITADO".
        let mut most_visited_idx = 0;
        let mut max_visits = -1;

        let root = &arena[0];
        for &child_idx in &root.children {
            let child = &arena[child_idx];
            if (child.visits as i32) > max_visits {
                max_visits = child.visits as i32;
                most_visited_idx = child_idx;
            }
        }

        let best_move_index = arena[most_visited_idx].move_idx?;
        Some(Coordinates::from_index(best_move_index, size))
    }
}

/// Helper function to reduce duplication: applies a move based solely on index.
fn apply_placement_from_idx(board: &mut GameY, move_idx: u32, size: u32) {
    if let Some(player) = board.next_player() {
        let coords = Coordinates::from_index(move_idx, size);
        let _ = board.add_move(Movement::Placement { player, coords });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameY, Movement, PlayerId};

    #[test]
    fn test_mcts_completo_bot_name() {
        let bot = MctsCompletoBot::new("mcts_hard", 1000);
        assert_eq!(bot.name(), "mcts_hard");
    }

    #[test]
    fn test_mcts_completo_bot_returns_move_on_empty_board() {
        let bot = MctsCompletoBot::new("mcts_hard", 1000);
        let game = GameY::new(5);
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }

    #[test]
    fn test_mcts_completo_bot_returns_valid_coordinates() {
        let bot = MctsCompletoBot::new("mcts_hard", 100);
        let game = GameY::new(5);
        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());
        assert!(index < 15);
    }

    #[test]
    fn test_mcts_completo_bot_returns_none_on_full_board() {
        let bot = MctsCompletoBot::new("mcts_hard", 1000);
        let mut game = GameY::new(2);
        // Llenamos el tablero (tamaño 2 tiene 3 celdas)
        let moves = vec![
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(1, 0, 0) },
            Movement::Placement { player: PlayerId::new(1), coords: Coordinates::new(0, 1, 0) },
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(0, 0, 1) },
        ];
        for mv in moves {
            let _ = game.add_move(mv);
        }
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_none());
    }

    #[test]
    fn test_apply_placement_helper() {
        let mut board = GameY::new(3);
        apply_placement_from_idx(&mut board, 0, 3);
        assert_eq!(board.available_cells().len(), 5); // size 3 has 6 cells, 1 assigned
        assert_eq!(board.next_player(), Some(PlayerId::new(1)));
    }
}
