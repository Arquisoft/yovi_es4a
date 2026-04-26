Feature: Juego Y

  Scenario: Navegar a Home tras continuar sin cuenta
    Given estoy en la página de inicio
    When pulso "Continuar sin cuenta"
    Then veo la variante "YOVI"
    And veo la variante "Clásico"
    And veo la variante "Human vs. Bot"

  Scenario: Configurar y empezar partida HvB clásica
    Given estoy en la página de inicio
    When pulso "Continuar sin cuenta"
    And pulso el botón "Jugar" en la sección HvB
    Then veo la pantalla de selección de dificultad
    And veo las opciones "Fácil", "Medio", "Difícil" y "Demencial"

    Scenario: Estoy en Home y cambio el modo de juego a "Tabu"
      Given estoy en la página de inicio
      When pulso "Continuar sin cuenta"
      And pulso "Cambiar variante"
      Then veo la pantalla de selección de variantes
      When pulso "Tabu Y"
      And pulso "Continuar con «Tabu Y»"
      Then veo la variante "Tabu Y"
      And veo la variante "Human vs. Human"

  Scenario: Seleccionar dificultad e iniciar partida
    Given estoy en la pantalla de selección de dificultad para HvB
    When selecciono la dificultad "Fácil"
    And pulso "Empezar partida"
    Then veo el tablero de juego
    And veo el indicador de turno

  Scenario: Empezar partida HvH
    Given estoy en la pantalla de configuración de la variante "classic"
    When pulso el botón "Jugar" en la sección HvH
    Then veo el tablero de juego HvH

  Scenario: El tablero muestra celdas jugables
    Given estoy jugando una partida HvB con bot "random_bot"
    Then el tablero tiene celdas clicables
    And la barra de estado indica de quién es el turno

  Scenario Outline: Iniciar alternativas de juego exóticas
    Given estoy en la pantalla de configuración de la variante "<variante>"
    When pulso el botón "Jugar" en la sección HvH
    Then veo el tablero de juego HvH

  Examples:
    | variante |
    | tabu |
    | holey |