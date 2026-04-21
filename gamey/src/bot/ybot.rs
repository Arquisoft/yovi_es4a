use crate::{Coordinates, GameAction, GameY};

/// Decision that a bot can return for the external competition API.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BotDecision {
    Move(Coordinates),
    Action(GameAction),
}

/// Trait representing a Y game bot (YBot)
/// A YBot is an AI that can choose moves in the game of Y.
/// Implementors of this trait must provide a name and a method to choose the
/// next decision given the current game state.
pub trait YBot: Send + Sync {
    /// Returns the name of the bot.
    fn name(&self) -> &str;

    /// Chooses the next action based on the current game state.
    ///
    /// By default, bots return a regular placement move. Bots that support
    /// actions such as swap or resign can override this and return a
    /// [`BotDecision::Action`].
    fn choose_action(&self, board: &GameY) -> Option<BotDecision>;

    /// Chooses a placement move based on the current game state.
    ///
    /// This helper keeps the rest of the project compatible with the original
    /// trait while allowing the external competition API to support actions.
    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        match self.choose_action(board) {
            Some(BotDecision::Move(coords)) => Some(coords),
            _ => None,
        }
    }
}
