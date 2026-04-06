Feature: Registro de usuarios

  @skip
  Scenario: Acceder a la página de bienvenida
    Given estoy en la página de inicio
    Then veo el título "Bienvenido a YOVI"
    And veo las pestañas "Iniciar Sesión" y "Registrarse"

  Scenario: Registro exitoso
    Given estoy en la página de inicio
    When cambio a la pestaña "Registrarse"
    And relleno el registro con username "e2euser01", email "e2euser01@test.com" y contraseña "Segura123!"
    And envío el formulario de registro
    Then veo un mensaje de éxito que contiene "Bienvenido"

  Scenario: Registro falla con contraseña débil
    Given estoy en la página de inicio
    When cambio a la pestaña "Registrarse"
    And relleno el registro con username "e2euser02", email "e2euser02@test.com" y contraseña "1234"
    And envío el formulario de registro
    Then veo un mensaje de error en el formulario