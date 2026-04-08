Feature: Juego Y

  Scenario: Navegar a selección de variante
    Given estoy en la página de inicio
    When pulso "Continuar sin cuenta"
    Then veo la pantalla de selección de variantes
    And veo la variante "Clásico"

  Scenario: Configurar y empezar partida HvB clásica
    Given estoy en la pantalla de configuración de la variante "classic"
    When pulso el botón "Jugar" en la sección HvB
    Then veo la pantalla de selección de dificultad
    And veo las opciones "Fácil", "Medio", "Difícil" y "Demencial"

  @skip
  Scenario: Seleccionar dificultad e iniciar partida
    Given estoy en la pantalla de selección de dificultad para HvB
    When selecciono la dificultad "Fácil"
    And pulso "Empezar partida"
    Then veo el tablero de juego
    And veo el indicador de turno

  @skip
  Scenario: Empezar partida HvH
    Given estoy en la pantalla de configuración de la variante "classic"
    When pulso el botón "Jugar" en la sección HvH
    Then veo el tablero de juego HvH

  @skip
  Scenario: El tablero muestra celdas jugables
    Given estoy jugando una partida HvB con bot "random_bot"
    Then el tablero tiene celdas clicables
    And la barra de estado indica de quién es el turno