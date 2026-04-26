import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spin, Result, Button } from "antd";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
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

        // Tras el éxito, redirigimos a /home en 3 segundos
        setTimeout(() => {
          navigate("/login");
        }, 4000);
      })
      .catch((err) => {
        setStatus("error");
        setMessageText(err.message);
      });
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
            tip={<div style={{ marginTop: "15px" }}>{messageText}</div>}
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
                key="home"
                onClick={() => navigate("/")}
              >
                Ir al Home ahora
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
                Volver al Inicio
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
