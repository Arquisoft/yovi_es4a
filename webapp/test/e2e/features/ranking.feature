Feature: Ranking

  Scenario: Ver página de ranking
    Given estoy en la página de inicio
    When navego a /ranking
    Then veo el título del ranking
    And veo la tabla de clasificación

  Scenario: Cambiar criterio de ordenación
    Given estoy en la página de ranking
    When cambio el criterio a "Partidas ganadas"
    Then la tabla se actualiza con el nuevo criterio