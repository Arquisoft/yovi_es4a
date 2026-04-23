import { useState, useEffect } from "react";
import { Button, Card, Flex, Input, InputNumber, Typography, Spin, Select, message } from "antd";
import { ArrowLeftOutlined, NodeIndexOutlined, UsergroupAddOutlined, CopyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import { socket } from "../api/socket";
import { VARIANTS } from "./VariantSelect";
import { getUserSession } from "../utils/session";

const { Title, Text, Paragraph } = Typography;

const MODE_MAP: Record<string, string> = {
  classic: "classic_hvh",
  tabu: "tabu_hvh",
  holey: "holey_hvh",
  fortune_dice: "fortune_dice_hvh",
  poly_y: "poly_hvh"
};

export default function MultiplayerLobby() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  
  // Join logic
  const [joinCode, setJoinCode] = useState("");
  
  // Create logic
  const [size, setSize] = useState<number | null>(11);
  const [modeId, setModeId] = useState("classic");

  useEffect(() => {
    socket.connect();
    
    const onPlayerJoined = () => {
      message.success("¡El rival se ha unido!");
      // Mover al host a la pantalla de juego
      navigate(`/multiplayer/${createdCode}`, { 
        state: { role: 'host', config: { size, mode: MODE_MAP[modeId] } } 
      });
    };

    socket.on("playerJoined", onPlayerJoined);

    return () => {
      socket.off("playerJoined", onPlayerJoined);
    };
  }, [createdCode, navigate, size, modeId]);

  const handleCreateRoom = () => {
    setLoading(true);
    const session = getUserSession();

    socket.emit(
      "createRoom",
      {
        size,
        mode: MODE_MAP[modeId],
        username: session?.username ?? null,
        profilePicture: session?.profilePicture ?? null,
      },
      (res: any) => {
        setLoading(false);
        if (res.success) {
          setCreatedCode(res.code);
          message.info(`Sala creada: ${res.code}. Esperando rival...`);
        } else {
          message.error("Error al crear la sala");
        }
      }
    );
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) return;
    setLoading(true);

    const session = getUserSession();

    socket.emit(
      "joinRoom",
      {
        code: joinCode.trim(),
        username: session?.username ?? null,
        profilePicture: session?.profilePicture ?? null,
      },
      (res: any) => {
        setLoading(false);
        if (res.success) {
          message.success("Unido correctamente");
          navigate(`/multiplayer/${joinCode.trim().toUpperCase()}`, { 
            state: { role: 'guest', config: res.roomConfig } 
          });
        } else {
          message.error(res.error || "Error al unirse a la sala");
        }
      }
    );
  };

  const cancelRoom = () => {
    if (createdCode) {
      socket.emit("leaveRoom", { code: createdCode });
      setCreatedCode(null);
    }
  };

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(720px, 100%)" }}>
        <Flex vertical gap={16} style={{ width: "100%" }}>
          <AppHeader title="YOVI Multijugador" />

          {createdCode ? (
             <Card>
               <Flex vertical align="center" gap={20} style={{ padding: "40px 0" }}>
                  <Spin size="large" />
                  <Title level={3} style={{ margin: 0 }}>Esperando a tu rival...</Title>
                  <Text type="secondary">Comparte este código para que se unan a tu partida</Text>
                  
                  <div style={{ 
                    background: "#f0f2f5", 
                    padding: "15px 30px", 
                    borderRadius: 12, 
                    border: "2px dashed #d9d9d9",
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                  }}>
                    <Text style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: "#1677ff" }}>
                      {createdCode}
                    </Text>
                    <Button 
                      icon={<CopyOutlined />} 
                      onClick={() => {
                        navigator.clipboard.writeText(createdCode);
                        message.success("Código copiado");
                      }} 
                    />
                  </div>

                  <Button danger onClick={cancelRoom}>Cancelar sala</Button>
               </Flex>
             </Card>
          ) : (
            <Card>
              <Flex gap={40} wrap="wrap">
                {/* Panel Crear Sala */}
                <div style={{ flex: "1 1 250px" }}>
                  <Title level={4}><NodeIndexOutlined /> Crear Nueva Sala</Title>
                  <Paragraph type="secondary">
                    Configura la partida, obtén un código y compártelo con tu rival.
                  </Paragraph>
                  
                  <Flex vertical style={{ width: "100%", marginTop: 10 }}>
                    <Text strong>Modo de juego:</Text>
                    <Select 
                      value={modeId} 
                      onChange={setModeId} 
                      style={{ width: "100%" }}
                      options={VARIANTS.filter(v => v.implemented).map(v => ({ value: v.id, label: `${v.emoji} ${v.label}` }))}
                    />

                    <Text strong style={{ marginTop: 10, display: "block" }}>Tamaño del tablero:</Text>
                    <InputNumber 
                      min={7} max={25} step={2} 
                      value={size} 
                      onChange={setSize} 
                      style={{ width: "100%" }} 
                    />

                    <Button type="primary" size="large" block onClick={handleCreateRoom} loading={loading} style={{ marginTop: 16 }}>
                      Generar Código
                    </Button>
                  </Flex>
                </div>

                <div style={{ width: "1px", background: "#f0f0f0" }} className="desktop-divider" />

                {/* Panel Unirse a Sala */}
                <div style={{ flex: "1 1 250px" }}>
                  <Title level={4}><UsergroupAddOutlined /> Unirse a Sala</Title>
                  <Paragraph type="secondary">
                    Si te han invitado, introduce el código de 5 dígitos para entrar.
                  </Paragraph>
                  
                  <Flex vertical style={{ width: "100%", marginTop: 10 }}>
                    <Text strong>Código de sala:</Text>
                    <Input 
                      placeholder="Ej: A4F92" 
                      size="large" 
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={5}
                      style={{ letterSpacing: 4, textTransform: "uppercase", fontWeight: "bold" }}
                      onPressEnter={handleJoinRoom}
                    />

                    <Button type="default" size="large" block onClick={handleJoinRoom} loading={loading} style={{ marginTop: 16 }}>
                      Entrar a la partida
                    </Button>
                  </Flex>
                </div>
              </Flex>
            </Card>
          )}

          {!createdCode && (
            <Flex justify="flex-start">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/home")}>
                Volver al Menú
              </Button>
            </Flex>
          )}
        </Flex>
      </div>
    </Flex>
  );
}
