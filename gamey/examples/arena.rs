use gamey::{GameY, GameStatus, MctsBot, MctsCompletoBot, Movement, YBot};
use std::time::Instant;

fn main() {
    println!("==============================================");
    println!("=        Arena: MCTS vs MCTS Completo         =");
    println!("==============================================");

    let num_games = 100;
    let size = 7; // Tamaño del tablero
    let mut mcts_wins = 0;
    let mut completo_wins = 0;

    let mcts = MctsBot::new("MCTS", 15000); // Ajusta la cantidad de simulaciones si tarda mucho
    let completo = MctsCompletoBot::new("MCTS Completo", 15000); 

    for i in 0..num_games {
        println!("----------------------------------------------");
        println!("Partida {} / {}", i + 1, num_games);
        
        let mut game = GameY::new(size);
        let start_time = Instant::now();

        // Alternamos el que empieza:
        // En juegos pares empieza MCTS (Player 0)
        // En juegos impares empieza MCTS Completo (Player 0)
        let mcts_starts = i % 2 == 0;
        
        if mcts_starts {
            println!("Empieza: {}", mcts.name());
        } else {
            println!("Empieza: {}", completo.name());
        }

        loop {
            if game.check_game_over() {
                break;
            }

            let next_player = game.next_player().unwrap();
            let is_mcts_turn = if mcts_starts {
                next_player.id() == 0 
            } else {
                next_player.id() == 1
            };

            let move_coords = if is_mcts_turn {
                mcts.choose_move(&game).expect("MCTS no encontró movimiento válido")
            } else {
                completo.choose_move(&game).expect("MCTS Completo no encontró movimiento válido")
            };

            game.add_move(Movement::Placement {
                player: next_player,
                coords: move_coords,
            }).unwrap();

            // Muestra el tablero turno a turno
            // println!("{}", game.render(&gamey::RenderOptions::default()));
        }

        let elapsed = start_time.elapsed();
        match game.status() {
            GameStatus::Finished { winner } => {
                if let Some(winner) = winner {
                    let mcts_won = if mcts_starts {
                        winner.id() == 0
                    } else {
                        winner.id() == 1
                    };

                    if mcts_won {
                        println!("=> ¡Ganador: {}! (Tiempo: {:.2?})", mcts.name(), elapsed);
                        mcts_wins += 1;
                    } else {
                        println!("=> ¡Ganador: {}! (Tiempo: {:.2?})", completo.name(), elapsed);
                        completo_wins += 1;
                    }
                } else {
                    println!("=> Empate. (Tiempo: {:.2?})", elapsed);
                }
            }
            _ => println!("Partida inacabada..."),
        }
    }

    println!("==============================================");
    println!("                 RESULTADOS                   ");
    println!("==============================================");
    println!("Partidas Jugadas: {}", num_games);
    println!("{:<20}: {} victorias", mcts.name(), mcts_wins);
    println!("{:<20}: {} victorias", completo.name(), completo_wins);
}
