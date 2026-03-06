import { Alert, Button, Card, Empty, Flex, Space, Typography } from "antd";
import type React from "react";

const { Title, Text } = Typography;

type Props = {
    title: string;
    subtitle: string;

    loading: boolean;
    error: string;

    // Para el estado "no hay partida"
    hasBoard: boolean;
    emptyText: string;

    onAbandon: () => void;
    abandonDisabled?: boolean;

    board: React.ReactNode;
    result?: React.ReactNode;
};

export default function GameShell({
    title,
    subtitle,
    loading,
    error,
    hasBoard,
    emptyText,
    onAbandon,
    abandonDisabled,
    board,
    result,
}: Props) {
    return (
        <Flex justify="center" align="start" style={{ padding: 20, minHeight: "100vh" }}>
            <div style={{ width: "min(1000px, 100%)" }}>
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Card>
                        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                            <Space direction="vertical" size={0}>
                                <Title level={3} style={{ margin: 0 }}>
                                    {title}
                                </Title>
                                <Text type="secondary">{subtitle}</Text>
                            </Space>

                            <Button danger onClick={onAbandon} disabled={!!abandonDisabled}>
                                Abandonar
                            </Button>
                        </Flex>
                    </Card>

                    {error && <Alert type="error" showIcon message={error} />}

                    {!hasBoard ? (
                        <Card>
                            <Empty
                                description={loading ? "Creando partida..." : emptyText}
                                image={Empty.PRESENTED_IMAGE_DEFAULT}
                                imageStyle={{ height: 120 }}
                            />
                        </Card>
                    ) : (
                        <>
                            {board}
                            {result}
                        </>
                    )}
                </Space>
            </div>
        </Flex>
    );
}