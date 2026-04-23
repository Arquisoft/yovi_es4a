Feature: Multijugador

  Scenario: Crear nueva sala multijugador
    Given estoy en la página de inicio
    When navego al Lobby de Multijugador
    And selecciono el modo de juego y guardo la sala
    Then veo el panel de espera con el código generado

  Scenario: Intentar unirse a una sala errónea
    Given estoy en la página de inicio
    When navego al Lobby de Multijugador
    And introduzco el código "XX123" y pulso entrar
    Then debería ver un mensaje de error de sala no encontrada
