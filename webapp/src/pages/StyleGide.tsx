import React from 'react';
import { Button, Input, Card, Typography, Space, Switch, Row, Col, Tag } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';


const { Title, Paragraph } = Typography;

const StyleGuide = () => {
  return (
    <div style={{ padding: '40px', background: '#f8f9fa', minHeight: '100vh' }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        
        <div>
          <Title level={2}>Guía de Estilo: Illustration Theme</Title>
          <Paragraph>
            Esta página te permite visualizar los tokens de diseño aplicados. 
            Si cambias `borderRadius` en <code>illustrationTheme.ts</code>, lo verás reflejado aquí.
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          {/* Columna 1: Botones y Acciones */}
          <Col xs={24} md={12}>
            <Card title="Botones y Estados" bordered={false}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space wrap>
                  <Button type="primary" icon={<UserOutlined />}>Acción Principal</Button>
                  <Button>Secundario</Button>
                  <Button type="dashed">Dashed</Button>
                </Space>
                <Space wrap>
                  <Button type="primary" danger>Peligro</Button>
                  <Button type="text">Solo Texto</Button>
                  <Button type="link">Enlace</Button>
                </Space>
                <Space align="center">
                  <span>Switch:</span> <Switch defaultChecked />
                </Space>
              </Space>
            </Card>
          </Col>

          {/* Columna 2: Entradas de Datos */}
          <Col xs={24} md={12}>
            <Card title="Formularios e Inputs" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input placeholder="Input estilo 'flat' con fondo gris" size="large" />
                <Input 
                  placeholder="Buscador..." 
                  prefix={<SearchOutlined style={{ color: '#ccc' }} />} 
                  size="large"
                />
                <Input.Password placeholder="Contraseña" size="large" />
              </Space>
            </Card>
          </Col>

          {/* Columna 3: Tarjetas y Elementos */}
          <Col xs={24}>
            <Card 
              cover={<div style={{ height: 100, background: 'linear-gradient(90deg, #722ed1 0%, #13c2c2 100%)' }} />}
              style={{ overflow: 'hidden' }}
              bordered={false}
            >
              <Card.Meta 
                avatar={<div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eee' }} />}
                title="Tarjeta estilo Ilustración"
                description="Fíjate en la sombra suave y los bordes redondeados (24px) que definimos en el tema."
              />
              <div style={{ marginTop: 16 }}>
                <Tag color="blue">Diseño</Tag>
                <Tag color="purple">UI/UX</Tag>
                <Tag color="green">Ant Design</Tag>
              </div>
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default StyleGuide;