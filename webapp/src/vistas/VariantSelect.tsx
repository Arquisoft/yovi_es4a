import { useState } from "react";
import { Button, Card, Flex, Space, Tag, Typography } from "antd";
import {
  ExperimentOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";

const { Title, Text, Paragraph } = Typography;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type VariantId =
  | "classic"
  | "pastel"
  | "master"
  | "fortune_coin"
  | "fortune_dice"
  | "tabu"
  | "holey"
  | "why_not"
  | "poly_y"
  | "hex";

export interface Variant {
  id: VariantId;
  label: string;
  emoji: string;
  tagLabel: string;
  tagColor: string;
  description: string;
  detail: string;
  implemented: boolean;
}

// ─── Definición de variantes ─────────────────────────────────────────────────

export const VARIANTS: Variant[] = [
  {
    id: "classic",
    label: "Clásico",
    emoji: "⬡",
    tagLabel: "Estándar",
    tagColor: "blue",
    description: "El juego Y original. Conecta los tres lados del tablero.",
    detail:
      "Dos jugadores se alternan colocando fichas. Gana quien conecte los tres lados del tablero triangular con una cadena continua de piezas propias.",
    implemented: true,
  },
  {
    id: "pastel",
    label: "Regla del Pastel",
    emoji: "🍰",
    tagLabel: "Fairness",
    tagColor: "orange",
    description: "Un jugador coloca la primera pieza, el otro elige bando.",
    detail:
      "El Jugador 1 elige dónde va la primera ficha. Entonces el Jugador 2 decide si prefiere quedarse con esa posición (intercambiar bandos) o ceder el turno. Elimina la ventaja de salir primero.",
    implemented: true,
  },
  {
    id: "master",
    label: "Master Y",
    emoji: "✌️",
    tagLabel: "2 piezas/turno",
    tagColor: "purple",
    description: "Igual que el clásico, pero cada turno se colocan 2 fichas.",
    detail:
      "Las reglas son idénticas al Y estándar salvo que en cada turno el jugador activo coloca exactamente 2 piezas en casillas libres. La estrategia cambia radicalmente al poder avanzar el doble cada vez.",
    implemented: true,
  },
  {
    id: "fortune_coin",
    label: "Fortune Y — Moneda",
    emoji: "🪙",
    tagLabel: "Azar",
    tagColor: "gold",
    description: "Antes de cada turno se lanza una moneda para decidir quién mueve.",
    detail:
      "Al inicio de cada turno se lanza una moneda: cara o cruz determina qué jugador coloca ficha ese turno. Un mismo jugador puede mover varias veces seguidas. El primero en conectar los tres lados gana.",
    implemented: true,
  },
  {
    id: "fortune_dice",
    label: "Fortune Y — Dado",
    emoji: "🎲",
    tagLabel: "Azar",
    tagColor: "gold",
    description: "El dado indica cuántas piezas puede colocar el jugador activo.",
    detail:
      "En cada turno se lanza un dado de 6 caras. El resultado indica cuántas piezas puede colocar ese turno el jugador activo. Luego el turno pasa al oponente. La volatilidad es alta y las remontadas son frecuentes.",
    implemented: true,
  },
  {
    id: "tabu",
    label: "Tabu Y",
    emoji: "🚫",
    tagLabel: "Restricción",
    tagColor: "red",
    description: "Prohibido colocar ficha adyacente al último movimiento rival.",
    detail:
      "Se juega exactamente como el Y estándar, pero existe una restricción adicional: no se puede colocar una pieza en ninguna de las casillas adyacentes a la última ficha colocada por el oponente. Obliga a planificar sin bloquear inmediatamente.",
    implemented: true,
  },
  {
    id: "holey",
    label: "Holey Y",
    emoji: "🕳️",
    tagLabel: "Tablero especial",
    tagColor: "cyan",
    description: "El tablero tiene agujeros: casillas permanentemente bloqueadas.",
    detail:
      "Antes de empezar, algunas casillas del tablero se marcan como agujeros de forma aleatoria. Ningún jugador puede colocar piezas en ellas durante toda la partida. Cambia completamente los caminos de conexión disponibles.",
    implemented: true,
  },
  {
    id: "why_not",
    label: "WhY not",
    emoji: "🔄",
    tagLabel: "Inversión",
    tagColor: "volcano",
    description: "Gana el primero en conectar los tres lados... ¡en conectar pierde!",
    detail:
      "Las reglas son idénticas al Y clásico, pero el objetivo se invierte: el primer jugador que forme una conexión de los tres lados del tablero con sus piezas ¡pierde la partida! Hay que conectar al adversario sin conectarse uno mismo.",
    implemented: true,
  },
  {
    id: "poly_y",
    label: "Poly-Y",
    emoji: "⭐",
    tagLabel: "Multi-esquina",
    tagColor: "geekblue",
    description: "Tablero de 5+ lados. Gana quien conquiste más esquinas.",
    detail:
      "Se juega en un tablero poligonal con un número impar de lados (mínimo 5). Un jugador «posee» una esquina si tiene un grupo de piezas que toca los dos lados que forman dicha esquina. Gana quien consiga poseer más esquinas al final.",
    implemented: true,
  },
  {
    id: "hex",
    label: "Hex",
    emoji: "🔷",
    tagLabel: "Tablero distinto",
    tagColor: "magenta",
    description: "Juego relacionado con Y pero en tablero rómbico de 11×11.",
    detail:
      "Jugado en un tablero rómbico (habitualmente 11×11). Cada jugador intenta conectar sus dos lados opuestos del tablero. No hay empates posibles. Comparte ADN matemático con el juego Y y es un clásico de la teoría de juegos.",
    implemented: true,
  },
];

// Exportación necesaria para App.tsx
export const DEFAULT_VARIANT = VARIANTS[0];

// ─── Componente ──────────────────────────────────────────────────────────────

type Props = {
  onSelect: (variant: Variant) => void;
};

export default function VariantSelect({ onSelect }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<VariantId>("classic");
  const [expanded, setExpanded] = useState<VariantId | null>(null);

  const selectedVariant = VARIANTS.find((v) => v.id === selected)!;

  function handleConfirm() {
    onSelect(selectedVariant);
  }

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(720px, 100%)" }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <AppHeader title="YOVI" />

          <Card>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Flex justify="center" align="center" vertical gap={4}>
                <Title level={3} style={{ margin: 0 }}>
                  Elige una variante
                </Title>
                <Text type="secondary">
                  Selecciona el modo de juego antes de configurar la partida
                </Text>
              </Flex>

              {/* Lista de variantes */}
              <Flex vertical gap={8}>
                {VARIANTS.map((variant) => {
                  const isSelected = selected === variant.id;
                  const isExpanded = expanded === variant.id;

                  return (
                    <Card
                      key={variant.id}
                      hoverable
                      size="small"
                      onClick={() => setSelected(variant.id)}
                      style={{
                        cursor: "pointer",
                        border: isSelected
                          ? "2px solid #1677ff"
                          : "2px solid transparent",
                        boxShadow: isSelected
                          ? "0 0 0 3px #1677ff22"
                          : undefined,
                        transition: "all 0.18s ease",
                        background: isSelected ? "#f0f7ff" : undefined,
                      }}
                    >
                      <Flex align="center" justify="space-between" gap={12}>
                        {/* Emoji + nombre + tag */}
                        <Flex align="center" gap={12} style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 26,
                              lineHeight: 1,
                              flexShrink: 0,
                            }}
                          >
                            {variant.emoji}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <Flex align="center" gap={8} wrap="wrap">
                              <Text strong style={{ fontSize: 14 }}>
                                {variant.label}
                              </Text>
                              <Tag color={variant.tagColor}>
                                {variant.tagLabel}
                              </Tag>
                            </Flex>
                            <Text
                              type="secondary"
                              style={{
                                fontSize: 12,
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {variant.description}
                            </Text>
                          </div>
                        </Flex>

                        {/* Botón de info */}
                        <Button
                          type="text"
                          size="small"
                          icon={<InfoCircleOutlined />}
                          style={{ flexShrink: 0, color: "#8c8c8c" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(isExpanded ? null : variant.id);
                          }}
                        />
                      </Flex>

                      {/* Panel expandido con descripción detallada */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid #f0f0f0",
                          }}
                        >
                          <Flex align="flex-start" gap={6}>
                            <ExperimentOutlined
                              style={{ color: "#1677ff", marginTop: 3, flexShrink: 0 }}
                            />
                            <Paragraph
                              style={{ margin: 0, fontSize: 13, color: "#595959" }}
                            >
                              {variant.detail}
                            </Paragraph>
                          </Flex>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </Flex>

              {/* Acciones */}
              <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/")}
                >
                  Volver
                </Button>

                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={handleConfirm}
                >
                  Continuar con «{selectedVariant.label}»
                </Button>
              </Flex>
            </Space>
          </Card>
        </Space>
      </div>
    </Flex>
  );
}