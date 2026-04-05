Feature: Historial de partidas

  Scenario: Acceder a historial sin sesión redirige a inicio
    Given no hay sesión activa
    When navego a "/historial"
    Then soy redirigido a la página de inicio

  Scenario: Ver historial con sesión activa
    Given tengo una sesión activa con usuario "testuser"
    When navego a "/historial"
    Then veo la página de historial de partidas
    And veo las estadísticas del usuario