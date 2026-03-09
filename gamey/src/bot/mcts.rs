use crate::{Coordinates, GameY, YBot, Movement, GameStatus, PlayerId};
use rand::prelude::IndexedRandom;
// IMPORTANTE: Necesitarás añadir `rayon = "1.10"` a tu Cargo.toml
use rayon::prelude::*; 

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
        // En Rust, rand::rng() es eficiente y seguro para hilos (thread-local),
        // lo que nos permite usarlo dentro de hilos paralelos sin bloqueos.
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

    /// TOMA DE DECISIÓN (PARALELIZADA):
    /// Evalúa cada movimiento posible realizando múltiples simulaciones para cada uno.
    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        // Obtenemos información básica del estado actual
        let available_cells = board.available_cells();
        let my_player = board.next_player()?; // Quién soy yo (el bot).
        let size = board.board_size();

        // Validación: si no hay celdas disponibles, no hay decisión que tomar
        if available_cells.is_empty() { return None; }

        // Dividimos el presupuesto de iteraciones entre los movimientos posibles.
        let simulations_per_move = self.iterations / (available_cells.len() as u32).max(1);

        // PARALELIZACIÓN: Usamos par_iter() para distribuir la evaluación de cada celda
        // entre todos los núcleos disponibles de la CPU.
        let best_result = available_cells.par_iter()
            .map(|&move_idx| {
                let mut wins = 0;
                
                // BUCLE DE SIMULACIONES: Se ejecuta de forma aislada en un hilo para esta celda.
                for _ in 0..simulations_per_move {
                    // CLONACIÓN: Cada hilo tiene su propia copia del tablero para simular.
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
                            wins += 1;
                        }
                    }
                }

                // Calculamos la tasa de victoria (win rate) para este movimiento específico.
                let win_rate = wins as f32 / simulations_per_move as f32;
                
                // Devolvemos el índice y su tasa para que rayon pueda compararlos.
                (move_idx, win_rate)
            })
            // REDUCCIÓN: Una vez que todos los hilos terminan, buscamos el máximo win_rate.
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        // Devolvemos las coordenadas que estadísticamente dieron más victorias.
        best_result.map(|(idx, _rate)| Coordinates::from_index(idx, size))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameY, PlayerId};

    #[test]
    fn test_mcts_bot_name() {
        let bot = MctsBot::new(100);
        assert_eq!(bot.name(), "mcts_bot");
    }

    #[test]
    fn test_mcts_bot_returns_move_on_empty_board() {
        let bot = MctsBot::new(100);
        let game = GameY::new(5);
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }
}