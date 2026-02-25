//! Command-line interface for the Y game.
//!
//! This module provides the CLI application for playing Y games interactively.

use crate::{
    Coordinates, GameAction, MctsBot, RandomBot, Movement, RenderOptions, YBot, YBotRegistry, game
};
use crate::{GameStatus, GameY, PlayerId};
use anyhow::Result;
use clap::{Parser, ValueEnum};
use rustyline::DefaultEditor;
use rustyline::error::ReadlineError;
use std::fmt::Display;
use std::sync::Arc;

/// Command-line arguments for the GameY application.
#[derive(Parser, Debug)]
#[command(author, version, about)]
#[command(long_about = "GameY: A command-line implementation of the Game of Y.")]
pub struct CliArgs {
    /// Size of the triangular board (length of one side).
    #[arg(short, long, default_value_t = 7)]
    pub size: u32,

    /// Game mode: human (2-player), computer (vs bot), or server (HTTP API).
    #[arg(short, long, default_value_t = Mode::Human)]
    pub mode: Mode,

    /// The bot to use (only used with --mode=computer).
    #[arg(short, long, default_value = "random_bot")]
    pub bot: String,

    /// If true, the bot will make the first move (only in computer mode).
    #[arg(long, default_value_t = false)]
    pub bot_first: bool,

    /// Port to run the server on (only used with --mode=server).
    #[arg(short, long, default_value_t = 3000)]
    pub port: u16,
}

/// The game mode determining how the game is played.
#[derive(Debug, Clone, Copy, ValueEnum, PartialEq)]
pub enum Mode {
    Computer,
    Human,
    Server,
}

impl Display for Mode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Mode::Computer => "computer",
            Mode::Human => "human",
            Mode::Server => "server",
        };
        write!(f, "{}", s)
    }
}

/// Runs the interactive CLI game loop.
pub fn run_cli_game() -> Result<()> {
    let args = CliArgs::parse();
    let mut render_options = crate::RenderOptions::default();
    let mut rl = DefaultEditor::new()?;
    
    // Registro de bots disponibles
    let bots_registry = YBotRegistry::new()
        .with_bot(Arc::new(RandomBot))
        .with_bot(Arc::new(MctsBot::new(15000))); // Nivel de dificultad alto

    let bot: Arc<dyn YBot> = match bots_registry.find(&args.bot) {
        Some(b) => b,
        None => {
            println!(
                "Bot '{}' not found. Available bots: {:?}",
                args.bot,
                bots_registry.names()
            );
            return Ok(());
        }
    };

    let mut game = game::GameY::new(args.size);

    // Lógica de inicio: ¿Empieza el bot?
    if args.mode == Mode::Computer && args.bot_first {
        println!("El bot ({}) está calculando su primer movimiento...", bot.name());
        trigger_bot_move(&mut game, bot.as_ref());
    }

    loop {
        println!("{}", game.render(&render_options));
        let status = game.status();
        match status {
            GameStatus::Finished { winner } => {
                println!("Game over! Winner: {}", winner);
                break;
            }
            GameStatus::Ongoing { next_player } => {
                let player = *next_player;
                let prompt = format!(
                    "Current player: {}, action (help = show commands)? ",
                    next_player
                );
                let readline = rl.readline(&prompt);
                match readline {
                    Err(ReadlineError::Interrupted) => {
                        println!("Interrupted");
                        break;
                    }
                    Err(err) => {
                        println!("Error: {:?}", err);
                        continue;
                    }
                    Ok(line) => {
                        rl.add_history_entry(line.as_str())?;
                        process_input(
                            &line,
                            &mut game,
                            &player,
                            &mut render_options,
                            args.mode,
                            bot.as_ref(),
                        )?;
                    }
                }
            }
        }
    }
    Ok(())
}

/// Processes a single line of user input and updates game state.
fn process_input(
    input: &str,
    game: &mut GameY,
    player: &PlayerId,
    render_options: &mut RenderOptions,
    mode: Mode,
    bot: &dyn YBot,
) -> Result<()> {
    let command = parse_command(input, game.total_cells());
    match command {
        Command::Place { idx } => {
            handle_place_command(game, idx, *player, mode, bot);
        }
        Command::Resign => {
            let movement = Movement::Action {
                player: *player,
                action: GameAction::Resign,
            };
            apply_move(game, movement, "Error adding resign move");
        }
        Command::Show3DCoords => render_options.show_3d_coords = !render_options.show_3d_coords,
        Command::ShowIdx => render_options.show_idx = !render_options.show_idx,
        Command::ShowColors => render_options.show_colors = !render_options.show_colors,
        Command::Help => print_help(),
        Command::Exit => {
            println!("Exiting the game.");
            std::process::exit(0);
        }
        Command::None => println!("No command entered."),
        Command::Error { message } => println!("Error parsing command: {}", message),
        Command::Save { filename } => {
            let path = std::path::Path::new(&filename);
            game.save_to_file(path)?;
        }
        Command::Load { filename } => {
            let path = std::path::Path::new(&filename);
            *game = GameY::load_from_file(path)?;
        }
    }
    Ok(())
}

pub fn parse_command(input: &str, bound: u32) -> Command {
    let parts: Vec<&str> = input.split_whitespace().collect();
    if parts.is_empty() { return Command::None; }
    match parts[0] {
        "save" => if parts.len() < 2 { Command::Error { message: "Filename required".into() } } else { Command::Save { filename: parts[1].into() } },
        "load" => if parts.len() < 2 { Command::Error { message: "Filename required".into() } } else { Command::Load { filename: parts[1].into() } },
        "resign" => Command::Resign,
        "help" => Command::Help,
        "exit" => Command::Exit,
        "show_colors" => Command::ShowColors,
        "show_coords" => Command::Show3DCoords,
        "show_idx" => Command::ShowIdx,
        str => match parse_idx(str, bound) {
            Ok(idx) => Command::Place { idx },
            Err(e) => Command::Error { message: format!("Error parsing: {}", e) },
        },
    }
}

fn print_help() {
    println!("Commands: <number> (place), resign, show_coords, show_idx, show_colors, save/load <file>, exit, help");
}

#[derive(Debug, PartialEq)]
pub enum Command {
    Place { idx: u32 },
    Resign,
    None,
    Error { message: String },
    Save { filename: String },
    Load { filename: String },
    Show3DCoords,
    ShowColors,
    ShowIdx,
    Exit,
    Help,
}

pub fn parse_idx(part: &str, bound: u32) -> Result<u32, String> {
    let n = part.parse::<u32>().map_err(|_| "not a number".to_string())?;
    if n >= bound { return Err(format!("out of bounds: {}", n)); }
    Ok(n)
}

fn handle_place_command(game: &mut GameY, idx: u32, player: PlayerId, mode: Mode, bot: &dyn YBot) {
    let coords = Coordinates::from_index(idx, game.board_size());
    let movement = Movement::Placement { player, coords };
    if apply_move(game, movement, "Invalid move") {
        if mode == Mode::Computer && !game.check_game_over() {
            trigger_bot_move(game, bot);
        }
    }
}

fn trigger_bot_move(game: &mut GameY, bot: &dyn YBot) {
    if let Some(bot_coords) = bot.choose_move(game) {
        if let Some(bot_player) = game.next_player() {
            let bot_movement = Movement::Placement { player: bot_player, coords: bot_coords };
            apply_move(game, bot_movement, "Bot move error");
        }
    }
}

fn apply_move(game: &mut GameY, movement: Movement, error_msg: &str) -> bool {
    match game.add_move(movement) {
        Ok(()) => true,
        Err(e) => {
            println!("{}: {}", error_msg, e);
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;
    use std::fs;

        // Tests cli_tests.rs inicial
    //
    // =============================================================================
    // parse_command Tests
    // =============================================================================

    #[test]
    fn test_parse_command_place_valid_index() {
        let command = parse_command("5", 10);
        assert_eq!(command, Command::Place { idx: 5 });
    }

    #[test]
    fn test_parse_command_place_zero_index() {
        let command = parse_command("0", 10);
        assert_eq!(command, Command::Place { idx: 0 });
    }

    #[test]
    fn test_parse_command_place_max_valid_index() {
        let command = parse_command("9", 10);
        assert_eq!(command, Command::Place { idx: 9 });
    }

    #[test]
    fn test_parse_command_place_index_out_of_bounds() {
        let command = parse_command("10", 10);
        assert!(matches!(command, Command::Error { .. }));
    }

    #[test]
    fn test_parse_command_place_large_index_out_of_bounds() {
        let command = parse_command("100", 10);
        assert!(matches!(command, Command::Error { .. }));
    }

    #[test]
    fn test_parse_command_resign() {
        let command = parse_command("resign", 10);
        assert_eq!(command, Command::Resign);
    }

    #[test]
    fn test_parse_command_help() {
        let command = parse_command("help", 10);
        assert_eq!(command, Command::Help);
    }

    #[test]
    fn test_parse_command_exit() {
        let command = parse_command("exit", 10);
        assert_eq!(command, Command::Exit);
    }

    #[test]
    fn test_parse_command_show_colors() {
        let command = parse_command("show_colors", 10);
        assert_eq!(command, Command::ShowColors);
    }

    #[test]
    fn test_parse_command_show_coords() {
        let command = parse_command("show_coords", 10);
        assert_eq!(command, Command::Show3DCoords);
    }

    #[test]
    fn test_parse_command_show_idx() {
        let command = parse_command("show_idx", 10);
        assert_eq!(command, Command::ShowIdx);
    }

    #[test]
    fn test_parse_command_save_with_filename() {
        let command = parse_command("save game.json", 10);
        assert_eq!(
            command,
            Command::Save {
                filename: "game.json".to_string()
            }
        );
    }

    #[test]
    fn test_parse_command_save_without_filename() {
        let command = parse_command("save", 10);
        assert!(matches!(command, Command::Error { .. }));
        if let Command::Error { message } = command {
            assert!(message.contains("Filename required"));
        }
    }

    #[test]
    fn test_parse_command_load_with_filename() {
        let command = parse_command("load saved_game.json", 10);
        assert_eq!(
            command,
            Command::Load {
                filename: "saved_game.json".to_string()
            }
        );
    }

    #[test]
    fn test_parse_command_load_without_filename() {
        let command = parse_command("load", 10);
        assert!(matches!(command, Command::Error { .. }));
        if let Command::Error { message } = command {
            assert!(message.contains("Filename required"));
        }
    }

    #[test]
    fn test_parse_command_empty_input() {
        let command = parse_command("", 10);
        assert_eq!(command, Command::None);
    }

    #[test]
    fn test_parse_command_whitespace_only() {
        let command = parse_command("   ", 10);
        assert_eq!(command, Command::None);
    }

    #[test]
    fn test_parse_command_invalid_command() {
        let command = parse_command("invalid_command", 10);
        assert!(matches!(command, Command::Error { .. }));
    }

    #[test]
    fn test_parse_command_negative_number() {
        let command = parse_command("-5", 10);
        assert!(matches!(command, Command::Error { .. }));
    }

    #[test]
    fn test_parse_command_with_leading_whitespace() {
        let command = parse_command("  5", 10);
        assert_eq!(command, Command::Place { idx: 5 });
    }

    #[test]
    fn test_parse_command_with_trailing_whitespace() {
        let command = parse_command("5  ", 10);
        assert_eq!(command, Command::Place { idx: 5 });
    }

    #[test]
    fn test_parse_command_save_with_path() {
        let command = parse_command("save /tmp/game.json", 10);
        assert_eq!(
            command,
            Command::Save {
                filename: "/tmp/game.json".to_string()
            }
        );
    }

    // =============================================================================
    // parse_idx Tests
    // =============================================================================

    #[test]
    fn test_parse_idx_valid_zero() {
        let result = parse_idx("0", 10);
        assert_eq!(result, Ok(0));
    }

    #[test]
    fn test_parse_idx_valid_middle() {
        let result = parse_idx("5", 10);
        assert_eq!(result, Ok(5));
    }

    #[test]
    fn test_parse_idx_valid_max() {
        let result = parse_idx("9", 10);
        assert_eq!(result, Ok(9));
    }

    #[test]
    fn test_parse_idx_out_of_bounds_equal() {
        let result = parse_idx("10", 10);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("out of bounds"));
    }

    #[test]
    fn test_parse_idx_out_of_bounds_larger() {
        let result = parse_idx("100", 10);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("out of bounds"));
    }

    #[test]
    fn test_parse_idx_not_a_number() {
        let result = parse_idx("abc", 10);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a number"));
    }

    #[test]
    fn test_parse_idx_negative_number() {
        let result = parse_idx("-1", 10);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a number"));
    }

    #[test]
    fn test_parse_idx_float_number() {
        let result = parse_idx("5.5", 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_idx_empty_string() {
        let result = parse_idx("", 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_idx_bound_of_one() {
        let result = parse_idx("0", 1);
        assert_eq!(result, Ok(0));

        let result = parse_idx("1", 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_idx_large_valid_number() {
        let result = parse_idx("999", 1000);
        assert_eq!(result, Ok(999));
    }

    // =============================================================================
    // Mode enum Tests
    // =============================================================================

    #[test]
    fn test_mode_display_computer() {
        let mode = Mode::Computer;
        assert_eq!(format!("{}", mode), "computer");
    }

    #[test]
    fn test_mode_display_human() {
        let mode = Mode::Human;
        assert_eq!(format!("{}", mode), "human");
    }

    #[test]
    fn test_mode_display_server() {
        let mode = Mode::Server;
        assert_eq!(format!("{}", mode), "server");
    }

    #[test]
    fn test_mode_equality() {
        assert_eq!(Mode::Computer, Mode::Computer);
        assert_eq!(Mode::Human, Mode::Human);
        assert_eq!(Mode::Server, Mode::Server);
        assert_ne!(Mode::Computer, Mode::Human);
        assert_ne!(Mode::Human, Mode::Server);
    }

    // =============================================================================
    // CliArgs parsing Tests (using clap's try_parse_from)
    // =============================================================================

    use clap::Parser;
    //use gamey::CliArgs;

    #[test]
    fn test_cli_args_default_values() {
        let args = CliArgs::try_parse_from(["gamey"]).unwrap();
        assert_eq!(args.size, 7);
        assert_eq!(args.mode, Mode::Human);
        assert_eq!(args.bot, "random_bot");
        assert_eq!(args.port, 3000);
    }

    #[test]
    fn test_cli_args_custom_size() {
        let args = CliArgs::try_parse_from(["gamey", "--size", "10"]).unwrap();
        assert_eq!(args.size, 10);
    }

    #[test]
    fn test_cli_args_custom_size_short() {
        let args = CliArgs::try_parse_from(["gamey", "-s", "5"]).unwrap();
        assert_eq!(args.size, 5);
    }

    #[test]
    fn test_cli_args_mode_computer() {
        let args = CliArgs::try_parse_from(["gamey", "--mode", "computer"]).unwrap();
        assert_eq!(args.mode, Mode::Computer);
    }

    #[test]
    fn test_cli_args_mode_human() {
        let args = CliArgs::try_parse_from(["gamey", "--mode", "human"]).unwrap();
        assert_eq!(args.mode, Mode::Human);
    }

    #[test]
    fn test_cli_args_mode_server() {
        let args = CliArgs::try_parse_from(["gamey", "--mode", "server"]).unwrap();
        assert_eq!(args.mode, Mode::Server);
    }

    #[test]
    fn test_cli_args_mode_short() {
        let args = CliArgs::try_parse_from(["gamey", "-m", "computer"]).unwrap();
        assert_eq!(args.mode, Mode::Computer);
    }

    #[test]
    fn test_cli_args_custom_bot() {
        let args = CliArgs::try_parse_from(["gamey", "--bot", "smart_bot"]).unwrap();
        assert_eq!(args.bot, "smart_bot");
    }

    #[test]
    fn test_cli_args_custom_bot_short() {
        let args = CliArgs::try_parse_from(["gamey", "-b", "my_bot"]).unwrap();
        assert_eq!(args.bot, "my_bot");
    }

    #[test]
    fn test_cli_args_custom_port() {
        let args = CliArgs::try_parse_from(["gamey", "--port", "8080"]).unwrap();
        assert_eq!(args.port, 8080);
    }

    #[test]
    fn test_cli_args_custom_port_short() {
        let args = CliArgs::try_parse_from(["gamey", "-p", "9000"]).unwrap();
        assert_eq!(args.port, 9000);
    }

    #[test]
    fn test_cli_args_combined_options() {
        let args = CliArgs::try_parse_from([
            "gamey",
            "-s",
            "9",
            "-m",
            "computer",
            "-b",
            "advanced_bot",
            "-p",
            "5000",
        ])
        .unwrap();
        assert_eq!(args.size, 9);
        assert_eq!(args.mode, Mode::Computer);
        assert_eq!(args.bot, "advanced_bot");
        assert_eq!(args.port, 5000);
    }

    #[test]
    fn test_cli_args_invalid_mode() {
        let result = CliArgs::try_parse_from(["gamey", "--mode", "invalid"]);
        assert!(result.is_err());
    }

    #[test]
    fn test_cli_args_invalid_size_not_number() {
        let result = CliArgs::try_parse_from(["gamey", "--size", "abc"]);
        assert!(result.is_err());
    }

    #[test]
    fn test_cli_args_invalid_port_not_number() {
        let result = CliArgs::try_parse_from(["gamey", "--port", "not_a_port"]);
        assert!(result.is_err());
    }

    #[test]
    fn test_cli_args_help_flag() {
        let result = CliArgs::try_parse_from(["gamey", "--help"]);
        assert!(result.is_err()); // --help causes an error (but it's intentional)
    }

    #[test]
    fn test_cli_args_version_flag() {
        let result = CliArgs::try_parse_from(["gamey", "--version"]);
        assert!(result.is_err()); // --version causes an error (but it's intentional)
    }

    // ###########################################################################################
    // TEST ADICIONALES PARA CUBRIR 80%
    // ###########################################################################################

    #[test]
    fn test_mode_logic() {
        assert_eq!(format!("{}", Mode::Computer), "computer");
        assert_eq!(format!("{}", Mode::Human), "human");
        assert_eq!(format!("{}", Mode::Server), "server");
        assert_eq!(Mode::Computer, Mode::Computer);
    }

    #[test]
    fn test_parse_idx_logic() {
        assert_eq!(parse_idx("5", 10), Ok(5));
        assert!(parse_idx("10", 10).is_err());
        assert!(parse_idx("abc", 10).is_err());
        assert!(parse_idx("-1", 10).is_err());
        assert!(parse_idx("", 10).is_err());
    }

    #[test]
    fn test_parse_command_all_branches() {
        let b = 100;
        // Comandos simples
        assert_eq!(parse_command("resign", b), Command::Resign);
        assert_eq!(parse_command("help", b), Command::Help);
        assert_eq!(parse_command("exit", b), Command::Exit);
        assert_eq!(parse_command("   ", b), Command::None);

        // Comandos de visualización
        assert_eq!(parse_command("show_colors", b), Command::ShowColors);
        assert_eq!(parse_command("show_coords", b), Command::Show3DCoords);
        assert_eq!(parse_command("show_idx", b), Command::ShowIdx);

        // Persistencia
        assert_eq!(parse_command("save f.json", b), Command::Save { filename: "f.json".into() });
        assert!(matches!(parse_command("save", b), Command::Error { .. }));
        assert!(matches!(parse_command("load", b), Command::Error { .. }));

        // Errores de parseo
        assert!(matches!(parse_command("999", 10), Command::Error { .. }));
        assert!(matches!(parse_command("inv", b), Command::Error { .. }));
    }

    #[test]
    fn test_process_input_exhaustive() {
        let mut game = GameY::new(7);
        let player = PlayerId::new(0);
        let mut opts = RenderOptions::default();
        let bot = RandomBot;

        // Probar ramas de persistencia (Save/Load)
        let tmp_file = "test_game_save.json";
        let _ = process_input(&format!("save {}", tmp_file), &mut game, &player, &mut opts, Mode::Human, &bot);
        assert!(std::path::Path::new(tmp_file).exists());
        let _ = process_input(&format!("load {}", tmp_file), &mut game, &player, &mut opts, Mode::Human, &bot);
        let _ = fs::remove_file(tmp_file);

        // Probar ramas de configuración visual (Toggle)
        opts.show_idx = false;
        let _ = process_input("show_idx", &mut game, &player, &mut opts, Mode::Human, &bot);
        assert!(opts.show_idx);

        // Ramas de error y ayuda
        let _ = process_input("help", &mut game, &player, &mut opts, Mode::Human, &bot);
        let _ = process_input("", &mut game, &player, &mut opts, Mode::Human, &bot); // None branch
        let _ = process_input("invalid_cmd_test", &mut game, &player, &mut opts, Mode::Human, &bot); // Error branch
    }

    #[test]
    fn test_apply_move_failure_branch() {
        let mut game = GameY::new(7);
        let player = PlayerId::new(0);
        
        // Movimiento en celda ya ocupada
        let _ = game.add_move(Movement::Placement { player, coords: Coordinates::from_index(0, 7) });
        let result = apply_move(&mut game, Movement::Placement { player, coords: Coordinates::from_index(0, 7) }, "Ocupada");
        assert!(!result); // Debe entrar en la rama del Err y retornar false
    }

    #[test]
    fn test_trigger_bot_move_safety() {
        let mut game = GameY::new(7);
        // Si el bot no encuentra movimiento (tablero lleno o similar)
        // Para este test, forzamos un estado donde el bot no mueva o simplemente lo llamamos
        trigger_bot_move(&mut game, &RandomBot);
        
        // Caso: Juego terminado (no hay next_player)
        let _ = game.add_move(Movement::Action { player: PlayerId::new(0), action: GameAction::Resign });
        trigger_bot_move(&mut game, &RandomBot); // Debe salir por el if let sin hacer nada
    }

    #[test]
    fn test_bot_registry_coverage() {
        let registry = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        assert!(registry.find("random_bot").is_some());
        assert!(registry.find("nonexistent").is_none());
        assert!(registry.names().contains(&"random_bot".to_string()));
    }

    #[test]
    fn test_cli_args_full_coverage() {
        let args = CliArgs::try_parse_from(["gamey", "--bot-first", "--mode", "computer", "--port", "1234"]).unwrap();
        assert!(args.bot_first);
        assert_eq!(args.port, 1234);

        // Metadata de ayuda (visita metadatos de Clap)
        let mut cmd = CliArgs::command();
        let help = cmd.render_help().to_string();
        assert!(help.contains("--size"));
    }

}