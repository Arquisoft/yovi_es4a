import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Drawer, Flex, Input, List, Typography } from "antd";
import { MessageOutlined, SendOutlined } from "@ant-design/icons";
import { resolveAvatarSrc } from "../utils/avatar";
import type { MultiplayerPlayerProfiles } from "../game/useMultiplayerGameSession";

const { Text } = Typography;

export interface ChatMessage {
  text: string;
  sender: "player0" | "player1";
  timestamp: number;
}

type Props = {
  open: boolean;
  myPlayer: string;
  messages: ChatMessage[];
  playerProfiles: MultiplayerPlayerProfiles;
  onClose: () => void;
  onSendMessage: (text: string) => void;
};

export default function MultiplayerChatDrawer({
  open,
  myPlayer,
  messages,
  playerProfiles,
  onClose,
  onSendMessage,
}: Props) {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setChatInput("");
  }

  return (
    <Drawer
      title={
        <span>
          <MessageOutlined /> Chat de Sala
        </span>
      }
      placement="right"
      onClose={onClose}
      open={open}
      styles={{
        body: { padding: 0, display: "flex", flexDirection: "column" },
        wrapper: { width: 350 },
      }}
      mask={false}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "15px 20px",
          background: "#fafafa",
        }}
      >
        <List
          dataSource={messages}
          renderItem={(item) => {
            const profile = playerProfiles[item.sender];
            const avatarSrc = profile?.profilePicture
              ? resolveAvatarSrc(profile.profilePicture)
              : undefined;
            const fallbackText =
              profile?.username?.trim()?.charAt(0).toUpperCase() ||
              (item.sender === "player0" ? "P0" : "P1");

            return (
              <List.Item
                style={{
                  border: "none",
                  padding: "4px 0",
                  justifyContent:
                    item.sender === myPlayer ? "flex-end" : "flex-start",
                }}
              >
                <Flex
                  vertical
                  align={item.sender === myPlayer ? "end" : "start"}
                >
                  <Flex
                    align="center"
                    gap={8}
                    style={{
                      flexDirection:
                        item.sender === myPlayer ? "row-reverse" : "row",
                    }}
                  >
                    <Avatar
                      size="small"
                      src={avatarSrc}
                      style={{
                        backgroundColor:
                          item.sender === "player0" ? "#28BBF5" : "#ff7b00",
                      }}
                    >
                      {fallbackText}
                    </Avatar>

                    <div
                      style={{
                        background:
                          item.sender === "player0" ? "#DDF5FD" : "#FFEEDB",
                        color: "inherit",
                        padding: "6px 12px",
                        borderRadius: 12,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        maxWidth: 240,
                        wordWrap: "break-word",
                      }}
                    >
                      {item.text}
                    </div>
                  </Flex>

                  <Text
                    type="secondary"
                    style={{ fontSize: 10, marginTop: 2 }}
                  >
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </Flex>
              </List.Item>
            );
          }}
        />
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: 15, borderTop: "1px solid #f0f0f0" }}>
        <Flex gap={10}>
          <Input
            placeholder="Escribe un mensaje..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onPressEnter={handleSend}
            autoFocus
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
          />
        </Flex>
      </div>
    </Drawer>
  );
}