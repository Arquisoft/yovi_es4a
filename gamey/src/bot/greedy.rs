use crate::{Coordinates, GameY, YBot};

/// Bot Greedy mejorado para el Juego de Y.
/// Se enfoca en el "Potencial de Conectividad" para unir los tres lados.
pub struct GreedyBot;

impl YBot for GreedyBot {
    fn name(&self) -> &str {
        "greedy_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available_cells = board.available_cells();
        let size = board.board_size();

        if available_cells.is_empty() {
            return None;
        }

        available_cells
            .iter()
            .map(|&index| {
                let coords = Coordinates::from_index(index, size);
                
                // Usamos los métodos públicos x(), y(), z() para respetar la privacidad
                let x = coords.x();
                let y = coords.y();
                let z = coords.z();

                // --- HEURÍSTICA DE PUNTUACIÓN (Menor es mejor) ---
                let mut score: i32 = 0;

                // 1. Proximidad a los bordes (Esencial para ganar en Y)
                // Buscamos que al menos una coordenada tienda a 0.
                let min_dist = x.min(y).min(z) as i32;
                score += min_dist * 15;

                // 2. Evitar el "aislamiento" en esquinas extremas
                // Las esquinas puras (donde dos coordenadas son 0) son poco flexibles.
                if (x == 0 && y == 0) || (y == 0 && z == 0) || (x == 0 && z == 0) {
                    score += 25;
                }

                // 3. Centralidad Estratégica
                // Queremos que la pieza "mire" hacia el centro para conectar con otros lados.
                // Calculamos la dispersión: si las coordenadas están balanceadas, la pieza es central.
                let balance = (x.max(y).max(z) - x.min(y).min(z)) as i32;
                score += balance * 5;

                (coords, score)
            })
            .min_by_key(|&(_, score)| score)
            .map(|(coords, _)| coords)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::GameY;

    #[test]
    fn test_greedy_bot_name() {
        let bot = GreedyBot;
        assert_eq!(bot.name(), "greedy_bot");
    }

    #[test]
    fn test_greedy_bot_chooses_strategic_move() {
        let bot = GreedyBot;
        let game = GameY::new(7);
        let chosen = bot.choose_move(&game);
        
        assert!(chosen.is_some());
        let coords = chosen.unwrap();
        
        // Verificamos que no elija una esquina extrema (0,0,6) si hay mejores opciones
        let zeros = [coords.x(), coords.y(), coords.z()].iter().filter(|&&v| v == 0).count();
        assert!(zeros < 2, "El bot debería evitar las esquinas muertas en el primer movimiento");
    }
}