# Implementación de un Bot MCTS para el Juego Y

## Introducción

Durante el desarrollo del proyecto, se decidió crear un bot que no dependiera de heurísticas programadas manualmente. La idea era lograr algo que pudiera descubrir estrategias por sí mismo mediante análisis estadístico. Así se llegó a implementar este bot basado en Monte Carlo Tree Search (MCTS). https://www.cs.us.es/~fsancho/Blog/posts/MCTS.md

> Evidentemente este articulo es realmente extenso y complejo, nuestra implementación está extremadamente simplificada.
> - Fase Simulación o Playout -> Esta fase está mas o menos completa
> - Fase de Selección / Decisión -> Extremadamente rudimentaria 
> - Fase de Expansión -> Ausente
> - Fase de Retropropagación -> Ausente
> 
> Se simplifica por motivos de complejidad de código y fundamentación matemática compleja


## Estructura Básica

La estructura del bot es bastante minimalista:

```rust
pub struct MctsBot {
    iterations: u32,
}

impl MctsBot {
    pub fn new(iterations: u32) -> Self {
        Self { iterations }
    }
}
```

Solo necesita un parámetro: el número de simulaciones que va a ejecutar. Al principio se probó con valores bajos (100-500 iteraciones) para hacer pruebas rápidas, pero se notó que la calidad de juego mejoraba bastante al subir a 1000-5000 iteraciones. El tradeoff es claro: más simulaciones significa mejor juego, pero también más tiempo esperando.

Con el ordenador que se probó (MacBook Air M4), 20000 iteraciones es bastante razonable y la precisión del bot es bastante buena, aunque un jugador realmente experimentado puede ganar perfectamente

## El Corazón del Algoritmo: Las Simulaciones

La función `simulate` es donde ocurre el análisis estadístico. Su trabajo es simple: toma un tablero y lo juega hasta el final de forma completamente aleatoria.

```rust
fn simulate(&self, mut virtual_board: GameY) -> Option<PlayerId> {
    let mut rng = rand::rng();
    
    loop {
        match virtual_board.status() {
            GameStatus::Finished { winner } => return Some(*winner),
            
            GameStatus::Ongoing { next_player } => {
                let available = virtual_board.available_cells();
                if let Some(&move_idx) = available.choose(&mut rng) {
                    let coords = Coordinates::from_index(move_idx, virtual_board.board_size());
                    let player = *next_player; 
                    
                    let _ = virtual_board.add_move(Movement::Placement {
                        player,
                        coords,
                    });
                } else {
                    return None;
                }
            }
        }
    }
}
```

La lógica es directa: mientras la partida no termine, se elige una celda aleatoria de las disponibles y se coloca ahí. No hay ninguna inteligencia en esta fase, y ese es precisamente el punto. Al ejecutar miles de estas simulaciones aleatorias, los patrones estadísticos emergen naturalmente.

Se decidió usar `available.choose(&mut rng)` de la crate `rand` porque es más eficiente que generar un índice aleatorio manualmente. Además, el código queda más limpio.

## Toma de Decisiones: El Método Principal

El método `choose_move` es donde se orquesta todo el proceso:

```rust
fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
    let available_cells = board.available_cells();
    let my_player = board.next_player()?;
    let size = board.board_size();

    if available_cells.is_empty() { return None; }

    let mut best_move = None;
    let mut max_wins = -1.0;
```

Primero se obtienen las celdas disponibles y se identifica qué jugador es el bot. Si no hay celdas disponibles, simplemente se retorna `None`. Se inicializa `max_wins` en -1.0 para asegurar que cualquier movimiento con tasa de victoria positiva lo supere.

### Evaluación de Cada Movimiento

Luego viene el bucle principal que evalúa cada movimiento posible:

```rust
for &move_idx in available_cells.iter() {
    let mut wins = 0;
    
    let simulations_per_move = self.iterations / (available_cells.len() as u32).max(1);

    for _ in 0..simulations_per_move {
        let mut sim_board = board.clone(); 
        let coords = Coordinates::from_index(move_idx, size);
        
        let _ = sim_board.add_move(Movement::Placement {
            player: my_player,
            coords,
        });

        if let Some(winner) = self.simulate(sim_board) {
            if winner == my_player {
                wins += 1;
            }
        }
    }
```

Para cada celda disponible, se divide el presupuesto total de iteraciones equitativamente. Se decidió hacer esta distribución uniforme porque simplifica la implementación y garantiza que todos los movimientos reciban el mismo análisis.

Para cada simulación, se clona el tablero actual (crucial para no modificar el estado real), se aplica el movimiento candidato, y luego se ejecuta una simulación aleatoria completa. Si el bot gana en esa simulación, se incrementa el contador.

Al principio se consideró usar `board.clone()` fuera del bucle interno y reutilizar esa copia, pero se descartó porque cada simulación necesita partir exactamente del mismo estado inicial con solo el movimiento candidato aplicado.

### Cálculo de la Tasa de Victoria

Después de todas las simulaciones para un movimiento, se calcula su efectividad:

```rust
    let win_rate = wins as f32 / simulations_per_move as f32;
    
    if win_rate > max_wins {
        max_wins = win_rate;
        best_move = Some(Coordinates::from_index(move_idx, size));
    }
}

best_move
```

La tasa de victoria es simplemente el porcentaje de simulaciones ganadas. Si este movimiento es mejor que el mejor encontrado hasta ahora, se actualiza. Al final, se retorna el movimiento con la mayor tasa de victoria.

## Decisiones de Diseño

### Versión Simplificada de MCTS

El MCTS clásico construye un árbol de búsqueda con selección UCB1, expansión progresiva y backpropagation. Se optó por una versión simplificada (a veces llamada "flat MCTS" o "MCTS simulation") por varias razones:

1. **Simplicidad**: El código es mucho más directo y fácil de mantener
2. **Suficientemente efectivo**: Para el alcance del proyecto, esta aproximación funciona bien

La desventaja es que no se concentran recursos en las líneas más prometedoras. En MCTS completo, el algoritmo dedica más simulaciones a los movimientos que van mostrando mejores resultados durante la búsqueda.

### Distribución Uniforme de Simulaciones

```rust
let simulations_per_move = self.iterations / (available_cells.len() as u32).max(1);
```

Se divide el presupuesto equitativamente entre todos los movimientos. Esto significa que al inicio de la partida (muchas celdas disponibles) cada movimiento recibe menos análisis que al final (pocas celdas disponibles).

El `.max(1)` está ahí simplemente para evitar división por cero, aunque en teoría si `available_cells` está vacío ya habríamos retornado antes.

### Simulaciones Completamente Aleatorias

Durante las simulaciones no se usa ninguna heurística para guiar los movimientos:

```rust
if let Some(&move_idx) = available.choose(&mut rng) {
    let coords = Coordinates::from_index(move_idx, size);
    let player = *next_player;
    // ...
}
```

Esto puede parecer ingenuo, pero tiene su lógica. Las simulaciones aleatorias son rápidas y no sesgadas. Si se introdujeran heurísticas, las simulaciones tardarían más y podrían sesgar los resultados hacia patrones que parecen buenos localmente pero no globalmente.

## Rendimiento y Ajustes

### Impacto del Parámetro de Iteraciones

Se hicieron pruebas con diferentes valores:

- **100 iteraciones**: Muy rápido pero decisiones cuestionables
- **500 iteraciones**: Balance razonable para pruebas
- **1000-2000 iteraciones**: Calidad decente de juego
- **5000+ iteraciones**: Buen nivel de juego pero tiempos de espera notables

Para tableros grandes con muchas celdas disponibles, el número efectivo de simulaciones por movimiento puede ser bastante bajo. Por ejemplo, con 2000 iteraciones y 30 celdas disponibles, cada movimiento solo recibe aproximadamente 66 simulaciones.

### Caso Extremo: Empates

```rust
} else {
    return None;
}
```

Si no hay celdas disponibles pero la partida no terminó (empate técnico), se retorna `None`. En la práctica, este caso debería ser raro en el juego Y, pero está cubierto por robustez.

## Integración con el Trait YBot

La implementación del trait es mínima:

```rust
impl YBot for MctsBot {
    fn name(&self) -> &str {
        "mcts_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        // ... implementación descrita arriba
    }
}
```

Se decidió llamarlo simplemente "mcts_bot" para diferenciarlo claramente del bot de selección aleatoria que era la única otra estrategia implementada.

## Resultados Observados

En pruebas contra el bot de selección aleatoria, este bot MCTS mostró comportamiento interesante:

- Contra selección aleatoria: Victoria consistente incluso con pocas iteraciones (500+)
- Con 100 iteraciones: A veces pierde contra aleatoria por mala suerte estadística
- Con 1000+ iteraciones: Dominio claro sobre selección aleatoria

Lo más interesante es que el bot ocasionalmente encuentra movimientos sorprendentes que no son obvios desde una perspectiva humana, pero que estadísticamente funcionan.

## Comparación con Selección Aleatoria

A diferencia del bot de selección aleatoria que simplemente elige cualquier celda disponible sin análisis:

```rust
// Bot aleatorio (aproximado)
let available = board.available_cells();
available.choose(&mut rng)
```

Este bot MCTS ejecuta cientos o miles de "partidas virtuales" para cada movimiento posible, acumulando estadísticas sobre cuáles movimientos tienden a llevar a la victoria. La diferencia en calidad de juego es significativa: donde el bot aleatorio gana por pura suerte ocasional, el bot MCTS gana consistentemente porque sus decisiones están respaldadas por análisis estadístico.

>Nota
> El bot no es infalible por la falta de heurístico de selección. En juegos de conexión como Y es realmente difícil encontrar un heurístico porque es difícil cuantificar cuando "nos estamos acercando a ganar"
## Conclusión

Este bot representa un enfoque fundamentalmente diferente al bot de selección aleatoria. En lugar de elegir sin criterio, confía en que la estadística revelará los mejores movimientos. La implementación es deliberadamente simple, sacrificando optimizaciones avanzadas por claridad y mantenibilidad.

Los resultados muestran que incluso esta versión simplificada de MCTS es significativamente superior a la selección aleatoria, validando el enfoque estadístico para la toma de decisiones en juegos.
