Feature: Login de usuarios

  Scenario: Continuar sin cuenta navega al juego
    Given estoy en la página de inicio
    When pulso "Continuar sin cuenta"
    Then soy redirigido a /home

  Scenario: Login falla con credenciales incorrectas
    Given estoy en la página de inicio
    When introduzco usuario "usuarioinexistente" y contraseña "wrongpass"
    And pulso iniciar sesión
    Then veo un mensaje de error de login