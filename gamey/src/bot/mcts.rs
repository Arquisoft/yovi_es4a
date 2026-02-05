use crate::{Coordinates, GameY, YBot, Movement, GameStatus, PlayerId};
use rand::prelude::IndexedRandom;

/// El Bot de Búsqueda de Árbol Monte Carlo (MCTS).
/// Este bot "juega" miles de partidas
/// aleatorias para determinar qué movimiento tiene la mayor probabilidad estadística de éxito.
pub struct MctsBot {
    /// Número total de simulaciones (playouts) que el bot realizará en cada turno.
    /// A mayor número, más "inteligente" es el bot, pero más tiempo tarda en decidir.
    iterations: u32,
}

impl MctsBot {
    pub fn new(iterations: u32) -> Self {
        Self { iterations }
    }

    /// FASE DE SIMULACIÓN (Playout):
    /// Toma un tablero y lo juega hasta el final de forma totalmente aleatoria.
    /// No busca ganar de forma inteligente aquí, solo busca un resultado estadístico rápido.
    fn simulate(&self, mut virtual_board: GameY) -> Option<PlayerId> {
        let mut rng = rand::rng();
        
        loop {
            match virtual_board.status() {
                // Si la partida virtual terminó, devolvemos quién ganó.
                GameStatus::Finished { winner } => return Some(*winner),
                
                // Si la partida sigue, elegimos un movimiento al azar entre los disponibles.
                GameStatus::Ongoing { next_player } => {
                    let available = virtual_board.available_cells();
                    if let Some(&move_idx) = available.choose(&mut rng) {
                        // Convertimos el índice a coordenadas
                        let coords = Coordinates::from_index(move_idx, virtual_board.board_size());
                        let player = *next_player; 
                        
                        // Aplicamos el movimiento al tablero virtual.
                        let _ = virtual_board.add_move(Movement::Placement {
                            player,
                            coords,
                        });
                    } else {
                        // Si no hay celdas pero nadie ganó (empate técnico).
                        return None;
                    }
                }
            }
        }
    }
}

impl YBot for MctsBot {
    fn name(&self) -> &str {
        "mcts_bot"
    }

    /// TOMA DE DECISIÓN:
    /// Evalúa cada movimiento posible realizando múltiples simulaciones para cada uno.
    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        // Obtenemos información básica del estado actual
        let available_cells = board.available_cells();
        let my_player = board.next_player()?; // Quién soy yo (el bot).
        let size = board.board_size();

        // Validación: si no hay celdas disponibles, no hay decisión que tomar
        if available_cells.is_empty() { return None; }

        // Variables para rastrear el mejor movimiento encontrado
        let mut best_move = None;
        let mut max_wins = -1.0;

        // BUCLE PRINCIPAL: Iteramos por cada casilla vacía disponible en el tablero actual.
        for &move_idx in available_cells.iter() {
            let mut wins = 0;
            
            // Dividimos el presupuesto de iteraciones entre los movimientos posibles.
            let simulations_per_move = self.iterations / (available_cells.len() as u32).max(1);

            // BUCLE DE SIMULACIONES: Ejecutamos múltiples playouts para este movimiento
            for _ in 0..simulations_per_move {
                // CLONACIÓN: Creamos una copia del estado real del juego para no alterarlo.
                let mut sim_board = board.clone(); 
                let coords = Coordinates::from_index(move_idx, size);
                
                // Realizamos el primer movimiento (el que estamos evaluando).
                let _ = sim_board.add_move(Movement::Placement {
                    player: my_player,
                    coords,
                });

                // Ejecutamos la simulación aleatoria hasta el final desde este punto.
                if let Some(winner) = self.simulate(sim_board) {
                    if winner == my_player {
                        wins += 1; // Si el bot gana en esta simulación, sumamos un punto.
                    }
                }
            }

            // Calculamos la tasa de victoria (win rate) para este movimiento específico.
            let win_rate = wins as f32 / simulations_per_move as f32;
            
            // Si este movimiento es mejor que el mejor encontrado hasta ahora, lo guardamos.
            if win_rate > max_wins {
                max_wins = win_rate;
                best_move = Some(Coordinates::from_index(move_idx, size));
            }
        }

        // Devolvemos las coordenadas que estadísticamente dieron más victorias.
        best_move
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameY, PlayerId};

    #[test]
    fn test_mcts_bot_name() {
        let bot = MctsBot::new(1000);
        assert_eq!(bot.name(), "mcts_bot");
    }

    #[test]
    fn test_mcts_bot_returns_move_on_empty_board() {
        let bot = MctsBot::new(1000);
        let game = GameY::new(5);
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }

    #[test]
    fn test_mcts_bot_returns_valid_coordinates() {
        let bot = MctsBot::new(1000);
        let game = GameY::new(5);
        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());
        assert!(index < 15); // Para un tablero de tamaño 5, hay 15 celdas disponibles
    }   

    #[test]
    fn test_mcts_bot_returns_none_on_full_board() {
        let bot = MctsBot::new(1000);
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
}  