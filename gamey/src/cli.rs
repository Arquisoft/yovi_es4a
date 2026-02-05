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
        "save" => if parts.len() < 2 { Command::Error { message: "File required".into() } } else { Command::Save { filename: parts[1].into() } },
        "load" => if parts.len() < 2 { Command::Error { message: "File required".into() } } else { Command::Load { filename: parts[1].into() } },
        "resign" => Command::Resign,
        "help" => Command::Help,
        "exit" => Command::Exit,
        "show_colors" => Command::ShowColors,
        "show_coords" => Command::Show3DCoords,
        "show_idx" => Command::ShowIdx,
        str => match parse_idx(str, bound) {
            Ok(idx) => Command::Place { idx },
            Err(e) => Command::Error { message: e },
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
    let n = part.parse::<u32>().map_err(|_| "Not a number".to_string())?;
    if n >= bound { return Err(format!("Out of bounds: {}", n)); }
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

    #[test]
    fn test_mode_display_computer() {
        assert_eq!(format!("{}", Mode::Computer), "computer");
    }

    #[test]
    fn test_mode_display_human() {
        assert_eq!(format!("{}", Mode::Human), "human");
    }

    #[test]
    fn test_mode_display_server() {
        assert_eq!(format!("{}", Mode::Server), "server");
    }

    #[test]
    fn test_parse_idx_valid() {
        assert_eq!(parse_idx("5", 10), Ok(5));
        assert_eq!(parse_idx("0", 10), Ok(0));
        assert_eq!(parse_idx("9", 10), Ok(9));
    }

    #[test]
    fn test_parse_idx_out_of_bounds() {
        let result = parse_idx("10", 10);
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
    fn test_parse_idx_negative() {
        let result = parse_idx("-1", 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_command_place() {
        let cmd = parse_command("5", 10);
        assert_eq!(cmd, Command::Place { idx: 5 });
    }

    #[test]
    fn test_parse_command_resign() {
        let cmd = parse_command("resign", 10);
        assert_eq!(cmd, Command::Resign);
    }

    #[test]
    fn test_parse_command_help() {
        let cmd = parse_command("help", 10);
        assert_eq!(cmd, Command::Help);
    }

    #[test]
    fn test_parse_command_exit() {
        let cmd = parse_command("exit", 10);
        assert_eq!(cmd, Command::Exit);
    }

    #[test]
    fn test_parse_command_show_colors() {
        let cmd = parse_command("show_colors", 10);
        assert_eq!(cmd, Command::ShowColors);
    }

    #[test]
    fn test_parse_command_show_coords() {
        let cmd = parse_command("show_coords", 10);
        assert_eq!(cmd, Command::Show3DCoords);
    }

    #[test]
    fn test_parse_command_show_idx() {
        let cmd = parse_command("show_idx", 10);
        assert_eq!(cmd, Command::ShowIdx);
    }

    #[test]
    fn test_parse_command_save() {
        let cmd = parse_command("save game.json", 10);
        assert_eq!(
            cmd,
            Command::Save {
                filename: "game.json".to_string()
            }
        );
    }

    #[test]
    fn test_parse_command_load() {
        let cmd = parse_command("load game.json", 10);
        assert_eq!(
            cmd,
            Command::Load {
                filename: "game.json".to_string()
            }
        );
    }

    #[test]
    fn test_parse_command_save_no_filename() {
        let cmd = parse_command("save", 10);
        match cmd {
            Command::Error { message } => {
                assert!(message.contains("Filename required"));
            }
            _ => panic!("Expected Error command"),
        }
    }

    #[test]
    fn test_parse_command_load_no_filename() {
        let cmd = parse_command("load", 10);
        match cmd {
            Command::Error { message } => {
                assert!(message.contains("Filename required"));
            }
            _ => panic!("Expected Error command"),
        }
    }

    #[test]
    fn test_parse_command_empty() {
        let cmd = parse_command("", 10);
        assert_eq!(cmd, Command::None);
    }

    #[test]
    fn test_parse_command_whitespace() {
        let cmd = parse_command("   ", 10);
        assert_eq!(cmd, Command::None);
    }

    #[test]
    fn test_parse_command_invalid_number() {
        let cmd = parse_command("abc", 10);
        match cmd {
            Command::Error { message } => {
                assert!(message.contains("Error parsing"));
            }
            _ => panic!("Expected Error command"),
        }
    }

    #[test]
    fn test_parse_command_out_of_bounds() {
        let cmd = parse_command("100", 10);
        match cmd {
            Command::Error { message } => {
                assert!(message.contains("out of bounds"));
            }
            _ => panic!("Expected Error command"),
        }
    }

    #[test]
    fn test_command_debug() {
        let cmd = Command::Place { idx: 5 };
        let debug = format!("{:?}", cmd);
        assert!(debug.contains("Place"));
        assert!(debug.contains("5"));
    }
}

