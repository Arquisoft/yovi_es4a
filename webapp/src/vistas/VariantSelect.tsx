import { useState } from "react";
import { Button, Card, Flex, Masonry, Space, Tag, Typography } from "antd";
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

import AppHeader from "./AppHeader";
import {
  DEFAULT_VARIANT,
  VARIANTS,
  type Variant,
  type VariantId,
} from "../game/variants";

const { Title, Text, Paragraph } = Typography;

export { DEFAULT_VARIANT, VARIANTS };
export type { Variant, VariantId };

type Props = {
  onSelect: (variant: Variant) => void;
  onBack: () => void;
};

export default function VariantSelect({ onSelect, onBack }: Props) {
  const [selected, setSelected] = useState<VariantId>(DEFAULT_VARIANT.id);
  const [expanded, setExpanded] = useState<VariantId | null>(null);

  const selectedVariant =
    VARIANTS.find((variant) => variant.id === selected) ?? DEFAULT_VARIANT;

  function handleConfirm() {
    onSelect(selectedVariant);
  }

  function renderVariantCard(variant: Variant) {
    const isSelected = selected === variant.id;
    const isExpanded = expanded === variant.id;

    return (
      <Card
        hoverable={variant.implemented}
        size="small"
        onClick={() => {
          if (variant.implemented) {
            setSelected(variant.id);
          }
        }}
        style={{
          cursor: variant.implemented ? "pointer" : "not-allowed",
          opacity: variant.implemented ? 1 : 0.6,
          border: isSelected ? "2px solid #1677ff" : "2px solid transparent",
          boxShadow: isSelected ? "0 0 0 3px #1677ff22" : undefined,
          transition: "all 0.18s ease",
          background: isSelected ? "#f0f7ff" : undefined,
          backgroundColor: !variant.implemented ? "#fafafa" : undefined,
        }}
      >
        <Flex align="center" justify="space-between" gap={12}>
          <Flex align="center" gap={12} style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 26,
                lineHeight: 1,
                flexShrink: 0,
                filter: !variant.implemented ? "grayscale(100%)" : "none",
              }}
            >
              {variant.emoji}
            </span>

            <div style={{ minWidth: 0 }}>
              <Flex align="center" gap={8} wrap="wrap">
                <Text strong style={{ fontSize: 14 }}>
                  {variant.label}
                </Text>

                <Tag color={variant.implemented ? variant.tagColor : "default"}>
                  {variant.tagLabel}
                </Tag>

                {!variant.implemented && (
                  <Tag color="default" style={{ margin: 0 }}>
                    Proximamente
                  </Tag>
                )}
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

          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            style={{ flexShrink: 0, color: "#8c8c8c" }}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(isExpanded ? null : variant.id);
            }}
          />
        </Flex>

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
              <Paragraph style={{ margin: 0, fontSize: 13, color: "#595959" }}>
                {variant.detail}
              </Paragraph>
            </Flex>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "min(920px, 100%)" }}>
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

              <Masonry
                columns={{ xs: 1, sm: 1, md: 2 }}
                gutter={8}
                fresh
                items={VARIANTS.map((variant) => ({
                  key: variant.id,
                  data: variant,
                }))}
                itemRender={(item) => renderVariantCard(item.data)}
              />

              <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                  Volver
                </Button>

                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={handleConfirm}
                  data-testid="variant-confirm-btn"
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
