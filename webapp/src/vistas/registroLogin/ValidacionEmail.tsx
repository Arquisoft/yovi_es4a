import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spin, Result, Button } from "antd";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [messageText, setMessageText] = useState(
    "Verificando tu cuenta en nuestros servidores...",
  );

  // Asegúrate de que apunte a tu gateway si estás usando Docker
  const apiEndpoint =
    import.meta.env.VITE_API_URL || "http://localhost:8000/api/users";

  const goToLogin = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    navigate("/");
  };

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessageText("Enlace no válido. Falta el código de verificación.");
      return;
    }

    // Llamamos al backend para que busque el token y active al usuario
    fetch(`${apiEndpoint}/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setStatus("success");
        setMessageText(data.message);

        // Tras el éxito, redirigimos a / en 6 segundos (el login está en /)
        timerRef.current = setTimeout(() => {
          goToLogin();
        }, 6000);
      })
      .catch((err) => {
        setStatus("error");
        setMessageText(err.message);
      });

    // Limpieza al desmontar para evitar fugas de memoria o redirecciones indeseadas
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchParams, navigate, apiEndpoint]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        {status === "loading" && (
          <Spin
            size="large"
            description={<div style={{ marginTop: "15px" }}>{messageText}</div>}
          />
        )}

        {status === "success" && (
          <Result
            status="success"
            title="¡Cuenta verificada!"
            subTitle={messageText}
            extra={[
              <Button
                type="primary"
                key="login"
                onClick={goToLogin}
              >
                Volver al Login
              </Button>,
            ]}
          />
        )}


        {status === "error" && (
          <Result
            status="error"
            title="Fallo en la verificación"
            subTitle={messageText}
            extra={
              <Button type="primary" onClick={() => navigate("/")}>
                Volver al Login
              </Button>
            }
          />
        )}

      </div>
    </div>
  );
}
